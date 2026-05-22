# Merging DDR data into seeds

!!! important
    You need to have a working setup of Tachi to use this script.

    For instructions on how to do that, see [Tachi Setup](../setup.md).

## Using `musicdb.xml`

We have a script that already exists for parsing a `musicdb.xml` file and merging it with the database seeds.
This is convenient for when you want to provide an update for DDR based off data you have.

### Importing DDR gamedata

Navigate to `seeds/scripts/rerunners/ddr`.  
The file you're looking to run is `parse-gameData-xml.ts`, but it needs two arguments:

- `--input`, which is the location of the `musicdb.xml` file you're looking to parse.
- `--version`, what version of the game this music db is from. For a list of versions, see the [DDR Config](../../game-support/games/ddr-SP.md#versions).

You can run this script by typing `ts-node parse-gameData-xml.ts --input YOUR_INPUT_HERE --version YOUR_VERSION_HERE` in the terminal.

For example, if your file is in the same directory as the script, and you're importing from DDR World:  
`ts-node parse-gameData-xml.ts --input ./musicdb.xml --version world`

!!! warning "Warning"

    If all the difficulties in your XML file are set to `255`, you will need to enter them manually before importing. 
    Otherwise, the song won't be imported properly, and the difficulties won't show up.

    If the song is also in DDR Konaste, and you have the relevant json file, you can copy the values over.  
    Alternatively, you can use [RemyWiki](https://remywiki.com/). Look up the song's name, then copy the difficulties manually from the table.

    - Search for your song on RemyWiki.
    - Scroll down to "Difficulty & Notecounts", then look for the table containing your game version.
    - Manually copy the difficulties from it.

    For example, with [Cheerleader](https://remywiki.com/Cheerleader):
    The difficulty in `musicdb.xml` is set to `<diffLv __type="u8" __count="10">255 255 255 255 255 0 255 255 255 255</diffLv>`, which is incorrect.  
    After following these steps, you should end up with `<diffLv __type="u8" __count="10">2 6 9 13 15 0 6 9 13 15</diffLv>`.

    Notes: There are 10 numbers, each one corresponding to a level of difficulty.
    The first 5 are for SP, and the remaining are for DP.
    The difficulty levels range from *BEGINNER*, *BASIC*, *DIFFICULT*, *EXPERT*, to *CHALLENGE*.
    Any difficulty above 19 will be ignored, and a difficulty of 0 means that the song does not have it.
    The *BEGINNER* field for DP is always set to 0 because it doesn't exist.

### Updating stepCounts

Step counts are generated from SSQ files. You're on your own to find them.

Place all of your SSQ files in the `ssq` folder. The name of each file should correspond to the `basename` of each song, which is a 4~5 characters identifier.
Then, run `ts-node parse-charts.ts`


## Using a JSON file

We have a script that already exists for parsing a JSON file and merging it with the database seeds.
This is convenient for when you want to provide an update for DDR based off data you have.

!!! danger "Important"

    JSON files are usually used for Konaste game data, and therefore won't have all arcade songs.  
    Due to encoding differences, songs may contain Unicode characters in them instead of their actual names. You will have to manually fix this.
    Additionally, the basename of existing songs may be edited incorrectly.  
    Therefore, this option is **not** recommended.

Navigate to `seeds/scripts/rerunners/ddr`.  
The file you're looking to run is `parse-gameData-json.ts`, but it needs two arguments:

- `--input`, which is the location of the JSON file you're looking to parse.
- `--version`, what version of the game this music db is from. For a list of versions, see the [DDR Config](../../game-support/games/ddr-SP.md#versions).

You can run this script by typing `ts-node parse-gameData-json.ts --input YOUR_INPUT_HERE --version YOUR_VERSION_HERE` in the terminal.

For example, if your file is in the same directory as the script, and you're importing from DDR Konaste:  
`ts-node parse-gameData-json.ts --input ./music.json --version konaste`