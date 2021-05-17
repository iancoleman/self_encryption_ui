Chunk = function(num, name, data) {

    let self = this;

    function prettyHashStr(hashBytes) {
        return uint8ArrayToHex(hashBytes).substring(0,7) + "...";
    }

    function prettyChunkStr(chunkBytes) {
        return uint8ArrayToHex(chunkBytes).substring(0,7) + "...";
    }

    // calculate safeurl
    let url = xornameToSafeUrl(name);

    // calculate size
    let size = data.length;
    let tidySize = getTidySize(size);

    let template = document.getElementById("chunk-template").innerHTML;
    let tempEl = document.createElement("tbody");
    tempEl.innerHTML = template;
    self.el = tempEl.querySelectorAll(".chunk")[0];
    // chunk number
    self.el.querySelectorAll(".num")[0].textContent = num;
    let tidyName = prettyHashStr(name);
    // chunk size
    self.el.querySelectorAll(".bytes")[0].textContent = size;
    if (tidySize.units != "B") {
        self.el.querySelectorAll(".tidybytes")[0].textContent = tidySize.size.toFixed(6);
        self.el.querySelectorAll(".tidyunits")[0].textContent = tidySize.units;
    }
    // chunk name
    self.el.querySelectorAll(".name")[0].textContent = tidyName;
    let tidyChunk = prettyChunkStr(data);
    // safeurl
    self.el.querySelectorAll(".safeurl")[0].textContent = url;
    // chunk content
    self.el.querySelectorAll(".content")[0].textContent = tidyChunk;

}
