use async_trait::async_trait;
use futures::executor;
use self_encryption::{DataMap, SelfEncryptionError, SelfEncryptor, Storage};
use tiny_keccak::{Hasher, Sha3};
use wasm_bindgen::prelude::*;
use sn_url::{SafeUrl, XorUrlBase};
use xor_name::XorName;

// smaller number of MAX_CHUNKS gives faster compile time
// up to 5 MiB input, use for development
//
//const MAX_CHUNKS: usize = 5;
//
// up to 1 GiB input, use for production
// 1 GiB is max self_encryption can accept
// but wasm can't compile that big, so use 512 MiB
// but 512 takes a very long time to self_encrypt, so use 50
// hopefully can parallelize in the future
//
const MAX_CHUNKS: usize = 50;

const CHUNK_SIZE: usize = 1024 * 1024 + 16;
const IO_SIZE: usize = CHUNK_SIZE * MAX_CHUNKS;
const NAME_SIZE: usize = 32;
const URL_SIZE: usize = 66;

// input
static mut INPUT_BYTES: [u8; IO_SIZE] = [0; IO_SIZE];

// output
static mut EXIT_CODE: u8 = 0;
static mut CHUNKS_COUNT: usize = 0;
static mut CHUNKS_SIZE: [usize; MAX_CHUNKS] = [0; MAX_CHUNKS];
static mut DATAMAP_SIZE: usize = 0;
static mut CHUNKS: [u8; IO_SIZE] = [0; IO_SIZE];
static mut DATAMAP: [u8; NAME_SIZE * MAX_CHUNKS] = [0; NAME_SIZE * MAX_CHUNKS];
static mut XORNAME: [u8; NAME_SIZE] = [0; NAME_SIZE];
static mut SAFEURL: [u8; URL_SIZE] = [0; URL_SIZE];

#[wasm_bindgen]
pub fn get_input_byte(i: usize) -> u8 {
    unsafe {
        INPUT_BYTES[i]
    }
}
#[wasm_bindgen]
pub fn set_input_byte(i: usize, v: u8) {
    unsafe {
        INPUT_BYTES[i] = v
    }
}
#[wasm_bindgen]
pub fn get_exit_code() -> u8 {
    unsafe {
        EXIT_CODE
    }
}
#[wasm_bindgen]
pub fn set_exit_code(v: u8) {
    unsafe {
        EXIT_CODE = v;
    }
}
#[wasm_bindgen]
pub fn get_chunks_count() -> usize {
    unsafe {
        CHUNKS_COUNT
    }
}
#[wasm_bindgen]
pub fn set_chunks_count(v: usize) {
    unsafe {
        CHUNKS_COUNT = v;
    }
}
#[wasm_bindgen]
pub fn get_chunks_size(i: usize) -> usize {
    unsafe {
        CHUNKS_SIZE[i]
    }
}
#[wasm_bindgen]
pub fn set_chunks_size(i: usize, v: usize) {
    unsafe {
        CHUNKS_SIZE[i] = v;
    }
}
#[wasm_bindgen]
pub fn get_datamap_size() -> usize {
    unsafe {
        DATAMAP_SIZE
    }
}
#[wasm_bindgen]
pub fn set_datamap_size(v: usize) {
    unsafe {
        DATAMAP_SIZE = v;
    }
}
#[wasm_bindgen]
pub fn get_byte_for_chunk(chunk_index: usize, byte_index: usize) -> u8 {
    unsafe {
        // each chunk may be a different size
        // so we need to work out where this chunk
        // starts in the CHUNKS bytes
        // by summing up the size of all prior chunks
        let mut start_index = 0;
        for i in 0..chunk_index {
            start_index = start_index + CHUNKS_SIZE[i];
        }
        let i = start_index + byte_index;
        get_chunks_byte(i)
    }
}
#[wasm_bindgen]
pub fn get_chunks_byte(i: usize) -> u8 {
    unsafe {
        CHUNKS[i]
    }
}
#[wasm_bindgen]
pub fn set_chunks_byte(i: usize, v: u8) {
    unsafe {
        CHUNKS[i] = v
    }
}
#[wasm_bindgen]
pub fn get_datamap_byte(i: usize) -> u8 {
    unsafe {
        DATAMAP[i]
    }
}
#[wasm_bindgen]
pub fn set_datamap_byte(i: usize, v: u8) {
    unsafe {
        DATAMAP[i] = v
    }
}
#[wasm_bindgen]
pub fn get_xorname_byte(i: usize) -> u8 {
    unsafe {
        XORNAME[i]
    }
}
#[wasm_bindgen]
pub fn set_xorname_byte(i: usize, v: u8) {
    unsafe {
        XORNAME[i] = v
    }
}
#[wasm_bindgen]
pub fn get_safeurl_byte(i: usize) -> u8 {
    unsafe {
        SAFEURL[i]
    }
}
#[wasm_bindgen]
pub fn set_safeurl_byte(i: usize, v: u8) {
    unsafe {
        SAFEURL[i] = v
    }
}

struct RamBasedStorage {
    pub chunks: Vec<u8>,
    pub datamap: Vec<u8>, // TODO consider when we need nested datamaps
}

#[async_trait]
impl Storage for RamBasedStorage {
    async fn get(&mut self, name: &[u8]) -> Result<Vec<u8>, SelfEncryptionError> {
        let total_names = self.datamap.len() / NAME_SIZE;
        for i in 0..total_names {
            let name_start = i*NAME_SIZE;
            let name_end = name_start+NAME_SIZE;
            let stored_name = &self.datamap[name_start..name_end];
            // see if the stored name matches the input name
            // by comparing byte by byte
            let mut matches = true;
            for i in 0..name.len() {
                if name[i] != stored_name[i] {
                    matches = false;
                    break;
                }
            }
            if matches {
                let mut chunk_start: usize = 0;
                for c in 0..i {
                    chunk_start = chunk_start + get_chunks_size(c);
                }
                let chunk_size = get_chunks_size(i);
                let chunk_end = chunk_start + chunk_size;
                let chunk = &self.chunks[chunk_start..chunk_end];
                return Ok(chunk.to_vec());
            }
        }
        Err(SelfEncryptionError::Generic("IO Error".to_string()))
    }

    async fn put(&mut self, name: Vec<u8>, data: Vec<u8>) -> Result<(), SelfEncryptionError> {
        // store name
        self.datamap.extend(name);
        // store data
        self.chunks.extend(data.clone());
        // store metadata about chunk size and total chunks
        let chunk_index = get_chunks_count();
        set_chunks_size(chunk_index, data.len());
        set_chunks_count(chunk_index + 1);
        Ok(())
    }

    async fn delete(&mut self, _name: &[u8]) -> Result<(), SelfEncryptionError> {
        // NOT IMPLEMENTED HERE
        Ok(())
    }


    async fn generate_address(&self, data: &[u8]) -> Result<Vec<u8>, SelfEncryptionError> {
        let mut hasher = Sha3::v256();
        let mut output = [0; NAME_SIZE];
        hasher.update(&data);
        hasher.finalize(&mut output);
        Ok(output.to_vec())
    }
}

#[wasm_bindgen]
pub fn xorname_to_safeurl() -> usize {
    let mut xor_name_bytes: [u8; 32] = [0u8; 32];
    for i in 0..NAME_SIZE {
        xor_name_bytes[i] = get_xorname_byte(i);
    }
    let xor_name = XorName(xor_name_bytes);
    let url = SafeUrl::encode_safekey(xor_name, XorUrlBase::Base32z).unwrap();
    let url_bytes = url.as_bytes();
    let url_len = url_bytes.len();
    for i in 0..url_len {
        set_safeurl_byte(i, url_bytes[i]);
    }
    return url_len;
}

#[wasm_bindgen]
pub fn self_encrypt_bytes(bytes_length: usize) {
    executor::block_on(async_self_encrypt_bytes(bytes_length));
}

// Assumes bytes to self encrypt is stored in INPUT_BYTES
async fn async_self_encrypt_bytes(bytes_length: usize) {
    // remove any previous exit code
    set_exit_code(0);
    // check input length is valid
    if bytes_length > IO_SIZE {
        set_exit_code(1);
        return;
    }
    // read the input
    let mut input_bytes = Vec::new();
    for i in 0..bytes_length {
        input_bytes.push(get_input_byte(i));
    }
    // do the self_encryption
    let mut storage = RamBasedStorage {
        datamap: Vec::new(),
        chunks: Vec::new(),
    };
    let se = SelfEncryptor::new(storage, DataMap::None).expect("shouldn't fail");
    se.write(&input_bytes, 0).await.expect("shouldn't fail");
    let (data_map, old_storage) = se.close().await.expect("shouldn't fail");
    storage = old_storage;
    // cache these results for wasm access
    match data_map {
        DataMap::Chunks(dm) => {
            // store chunks in wasm variables
            set_datamap_size(storage.datamap.len());
            let mut saved_chunk_data_len = 0;
            for chunk_details in dm {
                // name
                let name = chunk_details.hash;
                let name_start = NAME_SIZE * chunk_details.chunk_num;
                for i in 0..name.len() {
                    set_datamap_byte(name_start + i, name[i]);
                }
                // chunk
                let content = storage.get(&name).await.expect("shouldn't fail");
                for i in 0..content.len() {
                    set_chunks_byte(saved_chunk_data_len + i, content[i]);
                }
                saved_chunk_data_len = saved_chunk_data_len + content.len();
            }
        }
        DataMap::Content(content) => {
            set_chunks_count(0);
            set_datamap_size(content.len());
            for i in 0..content.len() {
                set_datamap_byte(i, content[i]);
            }
        }
        DataMap::None => {
            set_chunks_count(0);
            set_datamap_size(0);
        }
    }
}
