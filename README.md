# tuner

A chromatic tuner for your browser. Powered by [pitchy](https://github.com/ianprime0509/pitchy).

## Packaging this extension

```bash
# Generates an extension package
./scripts/build-package.sh

# These two files are generated:
# 1. `tmp/tuner` - and unpacked extension
# 2. `tmp/tuner.zip` - the zipped version, for uploading to Google Chrome developer dashboard

# Run it
rm -rf tmp/chrome-profile && /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --no-first-run --no-default-browser-check --user-data-dir="$PWD/tmp/chrome-profile" --load-extension="$PWD/tmp/tuner"
```
