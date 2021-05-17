// Encoding conversions

// modified from https://stackoverflow.com/a/11058858
function asciiToUint8Array(a) {
    let b = new Uint8Array(a.length);
    for (let i=0; i<a.length; i++) {
        b[i] = a.charCodeAt(i);
    }
    return b;
}
// https://stackoverflow.com/a/19102224
// TODO resolve RangeError possibility here, see SO comments
function uint8ArrayToAscii(a) {
    return String.fromCharCode.apply(null, a);
}
// https://stackoverflow.com/a/50868276
function hexToUint8Array(h) {
    if (h.length == 0) {
        return new Uint8Array();
    }
    return new Uint8Array(h.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}
function uint8ArrayToHex(a) {
    return a.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
}
function uint8ArrayToByteStr(a) {
    return "[" + a.join(", ") + "]";
}
// https://stackoverflow.com/a/12713326
function uint8ArrayToBase64(a) {
    return btoa(String.fromCharCode.apply(null, a));
}
function base64ToUint8Array(b) {
    return new Uint8Array(atob(b).split("").map(function(c) {
            return c.charCodeAt(0);
    }));
}
function getTidySize(byteSize) {
    let tidySize = {
        size: byteSize,
        units: "B",
    };
    if (byteSize >= 1024 && byteSize < 1024*1024) {
        tidySize.size = byteSize / 1024;
        tidySize.units = "KiB";
    }
    if (byteSize >= 1024*1024) {
        tidySize.size = byteSize / 1024 / 1024;
        tidySize.units = "MiB";
    }
    return tidySize;
}

function xornameToSafeUrl(name) {
    for (let i=0; i<name.length; i++) {
        wasmExports.set_xorname_byte(i, name[i]);
    }
    let urlLen = wasmExports.xorname_to_safeurl();
    let urlBytes = new Uint8Array(urlLen);
    for (let i=0; i<urlLen; i++) {
        urlBytes[i] = wasmExports.get_safeurl_byte(i);
    }
    let url = uint8ArrayToAscii(urlBytes);
    return url;
}
