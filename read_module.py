import os

path = "node_modules/@getquip/expo-nordic-dfu/src/ExpoNordicDfuModule.ts"
if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        # Print in chunks to avoid truncation if possible, though tool limit might still apply.
        # But we mostly care about the end of the file where the export happens.
        print("--- START ---")
        print(content[:1000]) 
        print("... SKIPPING MIDDLE ...")
        print(content[-1000:])
        print("--- END ---")
else:
    print("File not found")
