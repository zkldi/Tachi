## Chart constants
Get the data by going to [譜面定数表](https://wikiwiki.jp/arcaea/%E8%AD%9C%E9%9D%A2%E5%AE%9A%E6%95%B0%E8%A1%A8)
or [譜面定数表 (Level 7以下)](https://wikiwiki.jp/arcaea/%E8%AD%9C%E9%9D%A2%E5%AE%9A%E6%95%B0%E8%A1%A8/%E8%AD%9C%E9%9D%A2%E5%AE%9A%E6%95%B0%E8%A1%A8%20%28Level%207%E4%BB%A5%E4%B8%8B%29) and paste in the contents
of this script in the browser console:

```js
(() => {
	function convertDifficulty(cssColor) {
		switch (cssColor) {
			case "deepskyblue":
				return "Past";
			case "mediumseagreen":
				return "Present";
			case "mediumvioletred":
				return "Future";
			case "firebrick":
				return "Beyond";
			case "slateblue":
				return "Eternal"
			default:
				throw new Error(
					`Unknown difficulty color ${cssColor}. Update the script and try again.`
				);
		}
	}

	function parseTables(tables, expectedHeaderCells, offsets) {
		const results = [];

		const minimumRowSize = Math.max(...Object.values(offsets)) + 1;

		for (const table of tables) {
			const header = [...table.querySelectorAll("thead th")].map((th) => th.textContent);

			if (header.length !== expectedHeaderCells.length) {
				console.log(`Ignoring table with different header cell count: ${table}`);
				continue;
			}

			if (header.some((i) => !expectedHeaderCells.includes(i))) {
				throw new Error(
					`Unknown table format. Expected ${expectedHeaderCells}, but found ${header}. You might need to update the script.`
				);
			}

			for (const row of table.querySelectorAll("tbody tr")) {
				const cells = row.querySelectorAll("td");
				if (cells.length < minimumRowSize) {
					// Separator row
					continue;
				}

				const title = cells[offsets.title].querySelector("a.rel-wiki-page").textContent;
				const artist = cells[offsets.artist].textContent;
				const level = cells[offsets.level].textContent;
				const difficulty = convertDifficulty(cells[offsets.level].style.backgroundColor);
				const levelNum = Number(cells[offsets.chartConstant].textContent);

				if (Number.isNaN(levelNum)) {
					console.error(
						`Could not parse chart constant ${
							cells[offsets.chartConstant].textContent
						} of song ${title} to a number.`
					);
					continue;
				}

				results.push({ title, artist, difficulty, level, levelNum });
			}
		}

		return JSON.stringify(results, null, 4);
	}

	const tables = document.querySelectorAll("table");

	switch (location.pathname) {
		case "/arcaea/%E8%AD%9C%E9%9D%A2%E5%AE%9A%E6%95%B0%E8%A1%A8": // 譜面定数表, table for lv8-12
			copy(
				parseTables(tables, ["Artwork", "Song", "Composer", "Pack", "Lv.", "定数"], {
					title: 2,
					artist: 3,
					level: 5,
					chartConstant: 6,
				})
			);
			break;
		case "/arcaea/%E8%AD%9C%E9%9D%A2%E5%AE%9A%E6%95%B0%E8%A1%A8/%E8%AD%9C%E9%9D%A2%E5%AE%9A%E6%95%B0%E8%A1%A8%20%28Level%207%E4%BB%A5%E4%B8%8B%29":
			// 譜面定数表 (Level 7以下), table for lv1-7
			copy(
				parseTables(tables, ["Song", "Composer", "Lv.", "定数"], {
					title: 0,
					artist: 2,
					level: 3,
					chartConstant: 4,
				})
			);
			break;
		default:
			throw new Error(`Unknown path ${location.pathname}. If you're sure you're on the correct page, please update the script.`)
	}
})();
```

Chart constant data will now be copied into your clipboard. Paste them into `upper.json` and `lower.json` respectively.

Run `node parse-scraped-data.js`

## Note counts
Go to [ノーツ数順](https://wikiwiki.jp/arcaea/%E3%83%8E%E3%83%BC%E3%83%84%E6%95%B0%E9%A0%86) and paste this script
into the browser console:

```js
(() => {
	const EXPECTED_HEADER_CELLS = ["Notes", "Song", "Composer", "Diff.", "Lv.", "F", "L", "A", "S"];

	const results = [];

	const tables = document.querySelectorAll("table");

	for (const table of tables) {
		const header = [...table.querySelectorAll("thead th")].map((th) => th.textContent);

		if (header.length !== EXPECTED_HEADER_CELLS.length) {
			console.log(`Ignoring table with different header cell count: ${table}`);
			continue;
		}

		if (header.some((i) => !EXPECTED_HEADER_CELLS.includes(i))) {
			throw new Error(
				`Unknown table format. Expected ${EXPECTED_HEADER_CELLS}, but found ${header}. You might need to update the script.`
			);
		}

		for (const row of table.querySelectorAll("tbody tr")) {
			const cells = row.querySelectorAll("td");

			const title = cells[1].querySelector("a.rel-wiki-page").textContent;
			const artist = cells[2].textContent;
			const difficulty = cells[3].textContent;
			const level = cells[4].textContent;
			const notecount = Number(cells[0].textContent);

			if (Number.isNaN(notecount)) {
				console.error(`Could not parse notecount ${
					cells[0].textContent
				} of song ${title}, difficulty ${difficulty} to a number.`);
				continue;
			}

			results.push({ title, artist, difficulty, level, notecount });
		}
	}

	copy(JSON.stringify(results, null, 4));
})();
```

Notecount data will be copied to your clipboard. Paste the contents into `notecount.json`.

Run `node parse-scraped-data.js`.
