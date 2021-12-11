import type jQuery from "jquery";

declare global {
    interface Window {
        $: jQuery;
        jQuery: jQuery;
    }
}
