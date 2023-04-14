const compareByTitle = (itemA, itemB) => {
  let titleA = itemA.title.toLowerCase();
  let titleB = itemB.title.toLowerCase();

  if (titleA < titleB) return -1;
  else if (titleA > titleB) return 1;
  return 0;
};

const sortItems = (undone, done) => {
  done.sort(compareByTitle);
  undone.sort(compareByTitle);

  return [].concat(undone, done);
};

module.exports = {
  sortTodos: sortItems,
  sortTodoLists: sortItems
};