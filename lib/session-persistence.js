const seedData = require('./seed-data');
const deepCopy = require('./deep-copy');


class SessionPersistence {
  constructor(session) {
    this._todoLists = session.todoLists || deepCopy(SeedData);
    session.todoLists = this._todoLists;
  }
}

module.exports = SessionPersistence;