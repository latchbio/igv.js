/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Broad Institute
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import BWReader from "./bwReader.js"
import pack from "../feature/featurePacker.js"
import BaseFeatureSource from "../feature/baseFeatureSource.js"

class BWSource extends BaseFeatureSource {

    queryable = true
    #wgValues = {}
    windowFunctions = ["mean", "min", "max", "none"]

    constructor(config, genome) {
        super(genome)
        this.reader = new BWReader(config, genome)
        this.genome = genome
        this.format = config.format || "bigwig"
    }

    async getFeatures({chr, start, end, bpPerPixel, windowFunction}) {

        await this.reader.loadHeader()
        const isBigWig = this.reader.type === "bigwig"

        let features
        if ("all" === chr.toLowerCase()) {
            const wgChromosomeNames = this.genome.wgChromosomeNames
            features = isBigWig && wgChromosomeNames? await this.getWGValues(wgChromosomeNames, windowFunction, bpPerPixel) : []
        } else {
            features = await this.reader.readFeatures(chr, start, chr, end, bpPerPixel, windowFunction)
        }

        if (!isBigWig) {
            pack(features)
        }
        return features
    }

    async getHeader() {
        return this.reader.loadHeader()
    }

    async defaultVisibilityWindow() {
        if (this.reader.type === "bigwig") {
            return -1
        } else {
            return this.reader.featureDensity ? Math.floor(10000 / this.reader.featureDensity) : -1
        }

    }

    async getWGValues(wgChromosomeNames, windowFunction, bpPerPixel) {

        const genome = this.genome
        const cached = this.#wgValues[windowFunction]
        if (cached && cached.bpPerPixel > 0.8 * bpPerPixel && cached.bpPerPixel < 1.2 * bpPerPixel) {
            return cached.values
        } else {
            const features = await this.reader.readWGFeatures(wgChromosomeNames, bpPerPixel, windowFunction)
            let wgValues = []
            for (let f of features) {
                const chr = f.chr
                const offset = genome.getCumulativeOffset(chr)
                if (undefined === offset) continue
                const wgFeature = Object.assign({}, f)
                wgFeature.chr = "all"
                wgFeature.start = offset + f.start
                wgFeature.end = offset + f.end
                wgFeature._f = f
                wgValues.push(wgFeature)
            }
            wgValues.sort((a, b) => a.start - b.start)
            this.#wgValues[windowFunction] = {values: wgValues, bpPerPixel}
            return wgValues
        }
    }

    supportsWholeGenome() {
        return this.reader.type === "bigwig"
    }

    async trackType() {
        return this.reader.getTrackType()
    }

    get searchable() {
        return this.reader.searchable
    }

    async search(term) {
        return this.reader.search(term)
    }
}

export default BWSource
