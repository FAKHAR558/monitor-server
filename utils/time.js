// utils/time.js
function getUTCDateString(timestamp) {
  const d = new Date(timestamp);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getUTCHoursMinutes(timestamp) {
  const d = new Date(timestamp);
  return {
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes()
  };
}

module.exports = {
  getUTCDateString,
  getUTCHoursMinutes
};
