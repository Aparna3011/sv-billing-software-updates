const { format } = require('date-fns');

function formatDate(value) {
  return value ? format(new Date(value), 'dd/MM/yyyy') : '';
}

module.exports = { formatDate };
