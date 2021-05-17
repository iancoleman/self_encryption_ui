// self_encryption wasm calls.
// Since they sometimes operate on single bytes at a time
// it's handy to have helpers to do the required looping.

let isWasming = false;

let wasmHelpers = new (function() {

// s is secret key unit8array
this.get_exit_code = function(s) {
    isWasming = true;
    let exit_code = wasmExports.get_exit_code();
    isWasming = false;
    return exit_code;
}

})();
