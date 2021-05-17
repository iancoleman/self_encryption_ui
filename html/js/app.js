(function() {

    let datamap = null;

    let DOM = {};
    DOM.fileContainer = document.querySelectorAll("#file-container")[0];
    DOM.file = document.querySelectorAll("#file")[0];
    DOM.fileInput = document.querySelectorAll("#file input")[0];
    DOM.chunksList = document.querySelectorAll("#chunks .list")[0];
    DOM.datamap = document.querySelectorAll("#datamap textarea")[0];
    DOM.datamapEncoding = document.getElementById("datamap-encoding");
    DOM.datamapHex = document.getElementById("datamap-hex");
    DOM.datamapAscii = document.getElementById("datamap-ascii");
    DOM.datamapBytes = document.getElementById("datamap-bytes");
    DOM.datamapNamesLabel = document.querySelectorAll("#datamap-encoding .names")[0];
    DOM.datamapNames = document.getElementById("datamap-names");
    DOM.inputSize = {};
    DOM.inputSize.bytes = document.querySelectorAll(".input-bytes")[0];
    DOM.inputSize.tidyBytes = document.querySelectorAll(".tidy-input-bytes")[0];
    DOM.inputSize.tidyUnits = document.querySelectorAll(".tidy-input-units")[0];
    DOM.outputSize = {};
    DOM.outputSize.bytes = document.querySelectorAll(".output-bytes")[0];
    DOM.outputSize.tidyBytes = document.querySelectorAll(".tidy-output-bytes")[0];
    DOM.outputSize.tidyUnits = document.querySelectorAll(".tidy-output-units")[0];

    function loadFile() {
        let file = DOM.fileInput.files[0];
        let reader= new FileReader();
        reader.onload = function(e) {
            // 57 seconds to load 50 MiB
            let secondsToLoad = e.target.result.byteLength / 1024 / 1024 * 57 / 50;
            let finishDate = new Date((new Date()).getTime() + (secondsToLoad * 1000));
            let finishTime = finishDate.toLocaleTimeString();
            DOM.file.parentElement.removeChild(DOM.file);
            let loadingMsg = file.name;
            loadingMsg += " is self encrypting, expected to take about ";
            loadingMsg += Math.round(secondsToLoad);
            loadingMsg += " seconds, should finish at about ";
            loadingMsg += finishTime;
            DOM.fileContainer.textContent = loadingMsg;
            let arraybuffer = e.target.result;
            let bytes = new Uint8Array(arraybuffer);
            // Display input size
            DOM.inputSize.bytes.textContent = bytes.length;
            let tidySize = getTidySize(bytes.length);
            if (tidySize.units == "B") {
                DOM.inputSize.tidyBytes.textContent = "";
                DOM.inputSize.tidyUnits.textContent = "";
            }
            else {
                DOM.inputSize.tidyBytes.textContent = tidySize.size.toFixed(3);
                DOM.inputSize.tidyUnits.textContent = tidySize.units;
            }
            setTimeout(function() {
                selfEncryptBytes(bytes);
            }, 100);
        }
        reader.readAsArrayBuffer(file);
    }

    function selfEncryptBytes(b) {
        // set input bytes
        for (let i=0; i<b.length; i++) {
            wasmExports.set_input_byte(i, b[i]);
        }
        // do the self encryption
        wasmExports.self_encrypt_bytes(b.length);
        // get the datamap
        let datamapSize = wasmExports.get_datamap_size();
        datamap = new Uint8Array(datamapSize);
        for (let i=0; i<datamapSize; i++) {
            datamap[i] = wasmExports.get_datamap_byte(i);
        }
        // get the chunks
        let chunksCount = wasmExports.get_chunks_count();
        let chunks = [];
        for (let i=0; i<chunksCount; i++) {
            let chunkSize = wasmExports.get_chunks_size(i);
            let chunk = new Uint8Array(chunkSize);
            for (let j=0; j<chunkSize; j++) {
                chunk[j] = wasmExports.get_byte_for_chunk(i, j);
            }
            chunks.push(chunk);
        }
        // display
        display(datamap, chunks);
    }

    function showDatamapWithEncoding() {
        if (datamap == null) {
            return;
        }
        if (DOM.datamapHex.checked) {
            DOM.datamap.value = uint8ArrayToHex(datamap);
        }
        else if (DOM.datamapAscii.checked) {
            DOM.datamap.value = uint8ArrayToAscii(datamap);
        }
        else if (DOM.datamapBytes.checked) {
            DOM.datamap.value = uint8ArrayToByteStr(datamap);
        }
        else if (DOM.datamapNames.checked) {
            let allNames = uint8ArrayToHex(datamap);
            let names = allNames.match(/.{1,64}/g)
            DOM.datamap.value = names.join("\n");
        }
    }

    function display(datamap, chunks) {
        // Total output size
        let outputSize = datamap.length;
        for (let i=0; i<chunks.length; i++) {
            outputSize += chunks[i].length;
        }
        DOM.outputSize.bytes.textContent = outputSize;
        let tidySize = getTidySize(outputSize);
        if (tidySize.units == "B") {
            DOM.outputSize.tidyBytes.textContent = "";
            DOM.outputSize.tidyUnits.textContent = "";
        }
        else {
            DOM.outputSize.tidyBytes.textContent = tidySize.size.toFixed(3);
            DOM.outputSize.tidyUnits.textContent = tidySize.units;
        }
        // There are two possible scenarios for chunks:
        // 1. data is too short so is all in datamap
        if (chunks.length == 0) {
            // hide names encoding option
            if (DOM.datamapNames.checked) {
                DOM.datamapHex.checked = true;
            }
            DOM.datamapNames.setAttribute("disabled", "disabled");
            DOM.datamapNamesLabel.classList.add("disabled");
            // show datamap
            showDatamapWithEncoding(datamap);
            // show nochunks
            let noChunks = document.createElement("tr");
            noChunks.innerHTML = document.getElementById("no-chunks-template").innerHTML;
            DOM.chunksList.innerHTML = "";
            DOM.chunksList.appendChild(noChunks);
            return;
        }
        // 2. datamap is a list of names, chunks is a list of chunks
        let totalChunks = wasmExports.get_chunks_count();
        let names = [];
        let hexnames = [];
        for (let i=0; i<totalChunks; i++) {
            // get name i
            let name = new Uint8Array(32);
            for (let j=0; j<32; j++) {
                name[j] = datamap[32*i + j];
            }
            names.push(name);
            let hexname = uint8ArrayToHex(name);
            hexnames.push(hexname);
        }
        // create output elements
        DOM.chunksList.innerHTML = "";
        for (let i=0; i<totalChunks; i++) {
            let name = names[i];
            let data = chunks[i];
            let chunk = new Chunk(i, name, data);
            DOM.chunksList.appendChild(chunk.el);
        }
        // show datamap as names
        DOM.datamapNames.checked = true;
        DOM.datamapNames.removeAttribute("disabled");
        DOM.datamapNamesLabel.classList.remove("disabled");
        showDatamapWithEncoding(datamap);
    }

    DOM.fileInput.addEventListener("change", loadFile);
    DOM.datamapHex.addEventListener("change", showDatamapWithEncoding);
    DOM.datamapAscii.addEventListener("change", showDatamapWithEncoding);
    DOM.datamapBytes.addEventListener("change", showDatamapWithEncoding);
    DOM.datamapNames.addEventListener("change", showDatamapWithEncoding);

})();
