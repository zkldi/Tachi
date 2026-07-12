# parse-wplus.js

### How to get the songlist

Get the songlist from the webui. Open your dev tools, look for a big .js with the song data inside of it.
Download it.
Then you can add this at the bottom of the .js :
```js
const fs = require('fs');
fs.writeFileSync('songlist.json', JSON.stringify(e));
```
Then run the .js with node.

Clearly not ideal, but it just works.

If you get an error about require not being defined, try replacing the first line with:
```js
import fs from 'fs';
```

If there are two consts containing song data instead of one, you can replace the variable passed to stringify with:
```js
a.concat(b)
```
where 'a' and 'b' are the 2 consts.
