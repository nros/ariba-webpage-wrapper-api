import type jQuery from "jquery";

declare global {
    interface Window {
        ariba: {
            AWWidgets: {
                DropDown: {
                    openDropdown: (node: jQuery) => void;
                    dropDownMenuAction: (node: jQuery, ...args: unknown[]) => void;
                }
            },
            Handlers: {
                fakeClick: (elem: HTMLElement) => void,
            },
            Menu: {
                PML: {
                    click: (elem: HTMLElement) => void;
                }
            }
        };
    }
}
