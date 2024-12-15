/* global DOMPurify, marked */

let result = {};

const checkNarrowScreen = () => {
  // Add the narrow class if the screen width is narrow
  if (document.getElementById("header").clientWidth < 640) {
    document.body.classList.add("narrow");
  } else {
    document.body.classList.remove("narrow");
  }
};

const copyContent = async () => {
  // TODO: answer should be copied as well
  const content = document.getElementById("content").textContent;
  const status = document.getElementById("status");

  // Copy the content to the clipboard
  await navigator.clipboard.writeText(content);
  status.textContent = chrome.i18n.getMessage("results_copied");
  setTimeout(() => status.textContent = "", 1000);
};

const tryJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
};

const generateAnswer = async (question) => {
  // TODO: modelId should be retrieved from the user settings
  // TODO: multi-turn conversation should be implemented
  const { apiKey } = await chrome.storage.local.get({ apiKey: "" });
  let contents = [];

  contents.push(result.request);
  contents.push({ role: "model", parts: [{ text: result.content }] });
  contents.push({ role: "user", parts: [{ text: question }] });

  console.log(contents);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: contents,
        safetySettings: [{
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_CIVIC_INTEGRITY",
          threshold: "BLOCK_NONE"
        }]
      })
    });

    const responseData = {
      ok: response.ok,
      status: response.status,
      body: tryJsonParse(await response.text())
    };

    return responseData.body.candidates[0].content.parts[0].text;
  } catch (error) {
    // TODO: error handling
    return ({
      ok: false,
      status: 1000,
      body: { error: { message: error.stack } }
    });
  }
};

const askQuestion = async () => {
  // TODO: disable the button while waiting for the answer
  // TODO: display waiting message while waiting for the answer
  // TODO: scroll to the bottom of the conversation
  // TODO: error handling
  const question = document.getElementById("question-text").value.trim();

  if (!question) {
    return;
  }

  // Create a new div element with the question
  const questionDiv = document.createElement("div");
  questionDiv.textContent = question;

  // Create a new div element with the formatted text
  const formattedQuestionDiv = document.createElement("div");
  formattedQuestionDiv.style.backgroundColor = "var(--nc-bg-3)";
  formattedQuestionDiv.innerHTML = DOMPurify.sanitize(marked.parse(questionDiv.innerHTML, { breaks: true }));

  // Append the formatted text to the conversation
  document.getElementById("conversation").appendChild(formattedQuestionDiv);
  document.getElementById("question-text").value = "";

  // Generate an answer to the question
  const answer = await generateAnswer(question);

  // Create a new div element with the answer
  const answerDiv = document.createElement("div");
  answerDiv.textContent = answer;

  // Create a new div element with the formatted text
  const formattedAnswerDiv = document.createElement("div");
  formattedAnswerDiv.innerHTML = DOMPurify.sanitize(marked.parse(answerDiv.innerHTML));

  // Append the formatted text to the conversation
  document.getElementById("conversation").appendChild(formattedAnswerDiv);
};

const initialize = async () => {
  // Check if the screen is narrow  
  checkNarrowScreen();

  // Disable links when converting from Markdown to HTML
  marked.use({ renderer: { link: ({ text }) => text } });

  // Set the text direction of the body
  document.body.setAttribute("dir", chrome.i18n.getMessage("@@bidi_dir"));

  // Set the text of elements with the data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = chrome.i18n.getMessage(element.getAttribute("data-i18n"));
  });

  // Restore the content from the session storage
  const urlParams = new URLSearchParams(window.location.search);
  const resultIndex = urlParams.get("i");
  result = (await chrome.storage.session.get({ [`r_${resultIndex}`]: "" }))[`r_${resultIndex}`];

  // Convert the content from Markdown to HTML
  const div = document.createElement("div");
  div.textContent = result.content;
  document.getElementById("content").innerHTML = DOMPurify.sanitize(marked.parse(div.innerHTML));
};

document.addEventListener("DOMContentLoaded", initialize);
document.getElementById("copy").addEventListener("click", copyContent);
document.getElementById("question-send").addEventListener("click", askQuestion);
window.addEventListener("resize", checkNarrowScreen);
