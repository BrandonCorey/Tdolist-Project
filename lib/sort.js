const compareByTitle = (itemA, itemB) => {
  let titleA = itemA.title.toLowerCase();
  let titleB = itemB.title.toLowerCase();

  if (titleA < titleB) return -1;
  else if (titleA > titleB) return 1;
  return 0;
};

const sortTodoLists = (lists) => {
  let done = lists.filter(list => list.isDone());
  let undone = lists.filter(list => !list.isDone());

  done.sort(compareByTitle);
  undone.sort(compareByTitle);

  return undone.concat(done);
};

const sortTodos = (todoList) => {
  let todos = todoList.todos;
  let done = todos.filter(todos => todos.isDone());
  let undone = todos.filter(todos => !todos.isDone());

  done.sort(compareByTitle);
  undone.sort(compareByTitle);

  return undone.concat(done);
};

module.exports = { sortTodos, sortTodoLists };