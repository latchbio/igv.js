import * as DOMUtils from "./utils/dom-utils.js"
import Panel from "./components/panel.js"
import Dialog from "./components/dialog.js"
import {colorPalettes} from "../util/colorPalletes.js"
import TrackView from "../trackView.js"

const colorPickerTrackTypeSet = new Set(['bedtype', 'alignment', 'annotation', 'variant', 'wig', 'interact', 'shoebox'])

const vizWindowTypes = new Set(['alignment', 'annotation', 'variant', 'eqtl', 'qtl', 'snp', 'shoebox', 'wig'])

const multiTrackSelectExclusionTypes = new Set(['sequence', 'ruler', 'ideogram'])

const autoScaleGroupColorHash =
    {}

class MenuUtils {
    constructor(browser) {
        this.browser = browser
        this.initialize()
    }

    initialize() {

        const panel = new Panel()
        panel.add('...')

        const config =
            {
                parent: this.browser.root,
                content: panel
            }

        this.dialog = new Dialog(config)
        this.browser.root.appendChild(this.dialog.elem)
        DOMUtils.hide(this.dialog.elem)
    }

    trackMenuItemList(trackView) {

        const list = []

        if (trackView.track.config.type !== 'sequence') {
            list.push(trackHeightMenuItem())
        }

        if (true === didMultiSelect(trackView)) {
            list.push(...this.multiSelectMenuItems(trackView))
        } else {
            if (trackView.track.config.type !== 'sequence') {
                list.push(trackRenameMenuItem())
            }
            list.push(...this.defaultMenuItems(trackView))
        }

        if (trackView.track.removable !== false) {
            list.push('<hr/>')
            list.push(trackRemovalMenuItem(trackView))
        }

        return list
    }

    defaultMenuItems(trackView) {

        const list = []

        if (canShowColorPicker(trackView.track)) {

            list.push('<hr/>')
            list.push(colorPickerMenuItem(trackView, "Set track color", "color"))
            list.push(unsetColorMenuItem(trackView, "Unset track color"))

            if (trackView.track.config.type === 'wig' || trackView.track.config.type === 'annotation') {
                list.push(colorPickerMenuItem(trackView, "Set alt color", "altColor"))
                list.push(unsetAltColorMenuItem(trackView, "Unset alt color"))
            }

        }

        if (trackView.track.menuItemList) {
            list.push(...trackView.track.menuItemList())
        }

        if (isVisibilityWindowType(trackView)) {
            list.push('<hr/>')
            list.push(visibilityWindowMenuItem(trackView.track.type))
        }

        return list
    }

    multiSelectMenuItems(trackView) {

        const list = []

        const selected = trackView.browser.getSelectedTrackViews()
        const isSingleTrackType = didSelectSingleTrackType(selected.map(({track}) => track.type))

        if (true === isSingleTrackType) {

            list.push(...this.defaultMenuItems(trackView))

            if ('wig' === trackView.track.type) {

                list.push('<hr/>')
                list.push(groupAutoScaleMenuItem())
            }

        } else {

            if (canShowColorPicker(trackView.track)) {

                list.push('<hr/>')
                list.push(colorPickerMenuItem(trackView, "Set track color", "color"))
                list.push(unsetColorMenuItem(trackView, "Unset track color"))

                if (trackView.track.config.type === 'wig' || trackView.track.config.type === 'annotation') {
                    list.push(colorPickerMenuItem(trackView, "Set alt color", "altColor"))
                    list.push(unsetAltColorMenuItem(trackView, "Unset alt color"))
                }

            }

        }

        return list

    }

}

function didMultiSelect(trackView) {
    const selected = trackView.browser.getSelectedTrackViews()
    return selected && selected.length > 1 && new Set(selected).has(trackView)
}

function isVisibilityWindowType(trackView) {
    const track = trackView.track
    const hasVizWindow = track && track.config && track.config.visibilityWindow !== undefined
    return hasVizWindow || (track && vizWindowTypes.has(track.type))
}

function groupAutoScaleMenuItem() {

    const element = document.createElement('div');
    element.textContent = 'Group autoscale';

    function click(e) {

        const colorPalette = colorPalettes['Dark2'];
        const randomIndex = Math.floor(Math.random() * colorPalette.length);

        const autoScaleGroupID = `auto-scale-group-${DOMUtils.guid()}`;
        autoScaleGroupColorHash[autoScaleGroupID] = colorPalette[randomIndex];

        const multiSelectedTrackViews = this.browser.getSelectedTrackViews();
        for (const {track} of multiSelectedTrackViews) {
            track.autoscaleGroup = autoScaleGroupID;
        }

        this.browser.updateViews();
    }

    return {element, doAllMultiSelectedTracks: true, click};

}

function visibilityWindowMenuItem(trackType) {

    const element = document.createElement('div');
    element.textContent = 'Set visibility window';

    function click(e) {

        const callback = () => {

            let value = this.browser.inputDialog.value;
            value = '' === value || undefined === value ? -1 : value.trim();

            this.visibilityWindow = Number.parseInt(value);
            this.config.visibilityWindow = Number.parseInt(value);

            this.trackView.updateViews();
        };

        const label = 'wig' === trackType ?
            'Visibility window (bp). Enter 0 for whole chromosome, -1 for whole genome.' :
            'Visibility window (bp). Enter 0 for whole chromosome.';
        const config =
            {
                label,
                value: this.visibilityWindow,
                callback
            };
        this.browser.inputDialog.present(config, e);

    }

    return {element, click};

}

function trackRemovalMenuItem(trackView) {

    const str = trackView.track.selected ? 'Remove tracks' : 'Remove track';

    const element = document.createElement('div');
    element.textContent = str;

    function trackRemovalHandler(e) {
        this.trackView.browser._removeTrack(this);
    }

    return {element, click: trackRemovalHandler, menuItemType: 'removeTrack'};

}

function colorPickerMenuItem(trackView, label, option) {

    const element = document.createElement('div');
    element.textContent = label;

    const click = event => {
        trackView.presentColorPicker(option, event);
    };

    return {element, click};
}

function unsetColorMenuItem(trackView, label) {

    const element = document.createElement('div');
    element.textContent = label;

    return {
        element,
        click: () => {
            trackView.track.color = trackView.track._initialColor || trackView.track.constructor.defaultColor;
            trackView.repaintViews();
        }
    };
}

function unsetAltColorMenuItem(trackView, label) {

    const element = document.createElement('div');
    element.textContent = label;

    return {
        element,
        click: () => {
            trackView.track.altColor = trackView.track._initialAltColor || trackView.track.constructor.defaultColor;
            trackView.repaintViews();
        }
    };
}

function trackRenameMenuItem() {

    const element = document.createElement('div');
    element.textContent = 'Set track name';

    function click(e) {

        const callback = () => {
            let value = this.browser.inputDialog.value;
            value = ('' === value || undefined === value) ? 'untitled' : value.trim();
            this.name = value;
        };

        const config =
            {
                label: 'Track Name',
                value: (getTrackLabelText(this) || 'unnamed'),
                callback
            };

        this.browser.inputDialog.present(config, e);

    }

    return {element, click};
}

function trackHeightMenuItem() {

    const element = document.createElement('div');
    element.textContent = 'Set track height';

    function dialogHandler(e) {

        const callback = () => {

            if (this.browser.inputDialog.value !== undefined) {

                const number = parseInt(this.browser.inputDialog.value, 10)

                if (number > 0){

                    const tracks = [];
                    if (this.trackView.track.selected) {
                        tracks.push(...(this.trackView.browser.getSelectedTrackViews().map(({track}) => track)));
                    } else {
                        tracks.push(this);
                    }

                    for (const track of tracks) {
                        // Explicitly setting track height turns off autoHeight
                        track.trackView.autoHeight = false;

                        // If explicitly setting the height adjust min or max, if necessary
                        if (track.minHeight !== undefined && track.minHeight > number) {
                            track.minHeight = number;
                        }
                        if (track.maxHeight !== undefined && track.maxHeight < number) {
                            track.minHeight = number;
                        }
                        track.trackView.setTrackHeight(number, true);

                        track.trackView.checkContentHeight();
                        track.trackView.repaintViews();
                    } // for (tracks)

                } // if ()

            } // if ()
        }

        const config =
            {
                label: 'Track Height',
                value: this.height,
                callback
            };

        this.browser.inputDialog.present(config, e);

    }

    return {element, dialog: dialogHandler};

}

function getTrackLabelText(track) {
    return track.name
}

function canShowColorPicker(track) {
    return undefined === track.type || (colorPickerTrackTypeSet.has(track.type) && 'heatmap' !== track.graphType)
}

function didSelectSingleTrackType(types) {
    const unique = [...new Set(types)]
    return 1 === unique.length
}

export {
    autoScaleGroupColorHash,
    canShowColorPicker,
    multiTrackSelectExclusionTypes,
    didSelectSingleTrackType
}

export default MenuUtils
