/** @type {import('cz-git').UserConfig} */
module.exports = {
  messages: {
    type: "Select the type of change you're committing:",
    subject: "Write a short description of the change:\n",
  },
  skipQuestions: ["scope", "body", "breaking", "footerPrefix", "footer", "confirmCommit"],
};
