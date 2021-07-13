#!/bin/bash -e

FILE="$(npm pack)"

echo "$FILE"
rm -rf tmp/tuner tmp/tuner.zip
mkdir -p tmp
tar xvzf "$FILE" -C tmp
mv tmp/package tmp/tuner
(cd tmp/tuner && zip -r ../tuner.zip .)
rm "$FILE"
