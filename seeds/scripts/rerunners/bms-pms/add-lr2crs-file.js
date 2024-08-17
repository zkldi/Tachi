const { MutateCollection } = require("../../util");
const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");
const { GAME_PT_CONFIGS } = require("tachi-common");

const { Command } = require("commander");

const program = new Command();
program
	.option("-c, --course <.lr2crs file>")
	.option("-p, --playtype <7K|14K>")
	.option("-s, --set <genocideDan | stslDan>")
	.option("-i, --index <start index>");

program.parse(process.argv);
const options = program.opts();

if (
	!options.course ||
	!["7K", "14K"].includes(options.playtype) ||
	!options.set ||
	Number.isNaN(Number(options.index))
) {
	throw new Error(`Missing parameters.`);
}

const parser = new XMLParser();

const data = parser.parse(fs.readFileSync(options.course));

const dans = GAME_PT_CONFIGS[`bms:${options.playtype}`].classes[options.set].values;
if (!dans) {
	throw new Error(`No such set ${options.set} exists`);
}

MutateCollection("bms-course-lookup.json", (courses) => {
	const existingCourses = new Set(courses.map((e) => e.md5sums));

	let i = dans.length - 1;
	for (const d of data.courselist.course) {
		const md5sums = d.hash.slice("00000000002000000000000000000a3a".length);
		if (existingCourses.has(md5sums)) {
			continue;
		}

		console.log(d, i, dans.values[i]);

		courses.push({
			title: d.title,
			md5sums,
			set: options.set,
			playtype: options.playtype,
			value: dans[i].id,
		});

		i--;
	}

	return courses;
});
