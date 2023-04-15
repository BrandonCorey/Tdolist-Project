const { Client } = require('pg');

const logQuery = (statement, params) => {
  let timestamp = new Date();
  let formattedTimestamp = timestamp.toString().slice(4,24);
  console.log(formattedTimestamp, statement, params)
}

const dbQuery = async (statement, ...params) => {
  let client = new Client({
    database: 'todo-lists',
    host: '/var/run/postgresql',
    port: 5432,
    user: 'nug',
  });

  await client.connect();
  logQuery(statement, params);
  let result = await client.query(statement, params);
  await client.end();

  return result;
}

module.exports = dbQuery;