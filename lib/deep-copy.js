
// We can only do this because we're working with ordinary objects
// We don't care about their prototypes or methods (which would be lost doing this)
const deepCopy = (obj) => {
  if (typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
};

module.exports = deepCopy;