module.exports = {
  timeoutPromise: function (time) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(true);
      })
    });
  }
}
