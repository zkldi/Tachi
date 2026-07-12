import { Command } from "commander";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";

import { type Music, parseGameData } from "./parse-gameData";

const parser = new XMLParser();

const program = new Command();
program.requiredOption("-i, --input <musicdb.xml>");
program.requiredOption("-v, --version <the version this mdb is for, a3, world, konaste, etc.>");

program.parse(process.argv);
const options = program.opts();

const gameData: Music[] = parser.parse(fs.readFileSync(options.input)).mdb.music;

parseGameData(options.version, gameData);
