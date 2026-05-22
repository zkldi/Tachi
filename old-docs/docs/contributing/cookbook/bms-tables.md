# Adding New BMS Tables

Adding new BMS tables to Tachi is remarkably simple.

Firstly, you need to edit `common/src/constants/bms-tables.ts`. Place your new table in the array.

Now, run the `rerunners/bms-pms/sync-bms-tablefolders.ts` script inside the database seeds.

Congratulations! You've added support for a BMS table.
