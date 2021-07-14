# tuner

A chromatic tuner for your browser. Powered by [pitchy](https://github.com/ianprime0509/pitchy).

[![Screenshot](https://user-images.githubusercontent.com/193136/125518766-d8938442-1dcd-43f4-9233-f022bba575d4.png)<br><br>![Available in Chrome web store](https://user-images.githubusercontent.com/193136/125632736-2b79be0c-952a-48c5-820c-8b5c86ff50e8.png)](https://chrome.google.com/webstore/detail/tuner/aljjbggdbpfcefnliggdhejickokofej)

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
