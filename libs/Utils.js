module.exports = {
  shuffleList: (list) => {
    for (let i = 0; i < list.length; i++) {
      const rand = Math.floor(Math.random() * list.length);
      const temp = list[rand];
      list[rand] = list[i];
      list[i] = temp;
    }
    return list;
  }
}
