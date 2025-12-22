import os

base_dir = "node_modules/@getquip/expo-nordic-dfu/src"
files = ["ExpoNordicDfu.types.ts", "ExpoNordicDfuModule.ts", "index.ts"]

with open("lib_source.txt", "w", encoding="utf-8") as outfile:
    for filename in files:
        path = os.path.join(base_dir, filename)
        if os.path.exists(path):
            outfile.write(f"\n--- {filename} ---\n")
            with open(path, "r", encoding="utf-8") as f:
                outfile.write(f.read())
        else:
            outfile.write(f"\n--- {filename} NOT FOUND ---\n")
