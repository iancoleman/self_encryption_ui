# How to build the project

```bash
$ wasm-pack build --target=web; python convert.py
```

This will create se-standalone.html which you can double click to use the tool.

# Dev vs Production

Edit src/lib.rs parameter MAX_CHUNKS depending on the use case.
