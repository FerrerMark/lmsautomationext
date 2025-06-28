const quizId = 230217; 
const quizURL = `https://bcpeducollege.elearningcommons.com/mod/quiz/view.php?id=${quizId}`; 
const maxQuestions = 51;
const answerMap = { a: "0", b: "1", c: "2", d: "3" }; 

const processedQuestions = new Set();
let questionCount = 0;

console.log("Content script loaded on page:", window.location.href);

if (document.querySelector("#username")) {
  document.querySelector("#password").value = "#Fe8080";
  document.querySelector("#loginbtn").click();
  console.log("Login attempted. Waiting for page to load...");
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);
  if (request.action === "ping") {
    console.log("Content script received ping message. Responding with pong.");
    sendResponse({ pong: true });
  } else if (request.action === "startQuiz") {
    startQuiz();
    sendResponse({ started: true });
  } else if (request.action === "processPage") {
    processQuizLoop();
    sendResponse({ started: true });
  }
});

function startQuiz() {
  console.log(`Navigating to quiz page: ${quizURL}`);
  window.location.href = quizURL;
}

async function startQuizAttempt() {
  const sesskeyFound = await waitForElement('input[name="sesskey"]', 10000);
  if (!sesskeyFound) {
    console.error("Sesskey element not found. Cannot proceed.");
    return;
  }

  const sesskeyElement = document.querySelector('input[name="sesskey"]');
  const sesskey = sesskeyElement ? sesskeyElement.value : null;
  if (!sesskey) {
    console.error("Sesskey not found on page. Cannot start quiz. Page HTML:", document.documentElement.outerHTML);
    return;
  }
  console.log(`Sesskey found: ${sesskey}`);

  let continueButton = document.querySelector('a[href*="continue.php"][textContent*="Continue your attempt"]') ||
                      document.querySelector('button[textContent*="Continue your attempt"]') ||
                      document.querySelector('input[type="submit"][value*="Continue your attempt"]');

  let startButton = document.querySelector('input[name="submitbutton"][value="Start attempt"]') ||
                   document.querySelector('input[type="submit"][value*="Start attempt"]') ||
                   document.querySelector('button[class*="btn"][textContent*="Start attempt"]');

  if (!continueButton) {
    const xpathContinueResult = document.evaluate(
      '//a[contains(text(), "Continue your attempt")]',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    continueButton = xpathContinueResult.singleNodeValue;
  }

  if (!startButton) {
    const xpathStartResult = document.evaluate(
      '//button[contains(text(), "Start attempt")]',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    startButton = xpathStartResult.singleNodeValue;
  }

  if (continueButton) {
    console.log("Found 'Continue your attempt' button. Clicking...");
    continueButton.click();
  } else if (startButton) {
    console.log("Found 'Start attempt' button. Clicking...");
    startButton.click();
  } else {
    console.log("No 'Continue your attempt' or 'Start attempt' button found. Looking for a form to submit...");

    const form = document.querySelector('form[action*="startattempt.php"]') ||
                 document.querySelector('form[action*="view.php"]') ||
                 document.querySelector('form[action*="continue.php"]');
    if (form) {
      console.log("Found form. Submitting form to start/continue quiz...");
      form.submit();
    } else {
      console.log("No form found. Attempting to construct start URL as a fallback...");
      const startAttemptURL = `https://bcpeducollege.elearningcommons.com/mod/quiz/startattempt.php?cmid=${quizId}&sesskey=${sesskey}&_qf__mod_quiz_form_preflight_check_form=1&submitbutton=Start%20attempt&x=Cancel`;
      console.log(`Navigating to start attempt URL: ${startAttemptURL}`);
      window.location.href = startAttemptURL;
    }
  }

  const quizStarted = await waitForQuizToStart();
  if (!quizStarted) {
    console.error("Quiz did not start. Check for errors or redirects.");
  }
}

async function waitForElement(selector, timeout = 10000) {
  console.log(`Waiting for element: ${selector}`);
  return new Promise((resolve) => {
    const interval = 500;
    let elapsed = 0;

    const checkElement = setInterval(() => {
      if (document.querySelector(selector)) {
        console.log(`Element ${selector} found.`);
        clearInterval(checkElement);
        resolve(true);
      } else if (elapsed >= timeout) {
        console.error(`Timeout: Element ${selector} not found within ${timeout}ms.`);
        clearInterval(checkElement);
        resolve(false);
      }
      elapsed += interval;
    }, interval);
  });
}

async function waitForQuizToStart() {
  console.log("Waiting for quiz to start...");
  return new Promise((resolve) => {
    const maxWaitTime = 30000; 
    const interval = 1000; 
    let elapsed = 0;

    const checkForQuestions = setInterval(() => {
      if (document.querySelector(".que")) {
        console.log("Quiz started! Questions detected.");
        clearInterval(checkForQuestions);
        resolve(true);
      } else if (elapsed >= maxWaitTime) {
        console.error("Timeout: Quiz did not start within 30 seconds. Current URL:", window.location.href);
        console.log("Page HTML for debugging:", document.documentElement.outerHTML);
        clearInterval(checkForQuestions);
        resolve(false);
      }
      elapsed += interval;
    }, interval);
  });
}

async function processQuizLoop() {
  console.log("Starting quiz processing loop...");
  let hasNextPage = true;
  while (hasNextPage && questionCount < maxQuestions) {
    console.log(`Processing page ${questionCount + 1}/${maxQuestions}`);
    hasNextPage = await processQuizPage();
    if (hasNextPage) {
      console.log("Waiting for next page to load...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  console.log("Quiz processing complete or stopped.");
}

async function processQuizPage() {
  const questionsFound = await waitForElement(".que", 10000);
  if (!questionsFound) {
    console.log("No questions found on this page. Stopping.");
    return false;
  }

  const questions = Array.from(document.querySelectorAll(".que")).map((qe) => {
    const questionTextElement = qe.querySelector(".qtext");
    const questionText = questionTextElement ? questionTextElement.innerHTML.trim() : "Question text not found";
    console.log("Extracted question text:", questionText);

    const optionsContainer = qe.querySelector(".answer");
    if (!optionsContainer) {
      console.error("Options container (.answer) not found for question:", questionText);
      return null;
    }

    const inputs = optionsContainer.querySelectorAll('input[type="radio"]');
    if (!inputs.length) {
      console.error("No radio inputs found in options container for question:", questionText);
      return null;
    }

    const options = Array.from(inputs).map((input, index) => {
      const labelElement = input.nextElementSibling || input.parentElement.querySelector(".ml-1") || input.parentElement.querySelector(".flex-fill");
      const label = labelElement ? labelElement.innerHTML.trim() : `Option ${index + 1} not found`;
      return {
        letter: String.fromCharCode(97 + index),
        label,
        value: input.getAttribute("value"),
        name: input.getAttribute("name"),
        input 
      };
    }).filter(opt => opt !== null);

    if (options.length === 0) {
      console.error("No valid options found for question:", questionText);
      return null;
    }

    const questionId = options[0]?.name.split("_")[0];
    console.log("Question ID:", questionId, "Options:", options);
    return { questionText, options, questionId };
  }).filter(q => q !== null);

  if (questions.length === 0) {
    console.log("No valid questions found on this page. Continuing to next page...");
    return true; 
  }

  for (const { questionText, options, questionId } of questions) {
    if (processedQuestions.has(questionText)) {
      console.log(`Repeated question: "${questionText}". Stopping.`);
      return false;
    }
    processedQuestions.add(questionText);
    questionCount++;
    console.log(`Processing question ${questionCount}: ${questionText}`);

    const optionsText = options.map((opt) => `${opt.letter}) ${opt.label}`).join(" ");
    const aiPrompt = `${questionText} ${optionsText} Please respond with only one letter: 'a', 'b', 'c', or 'd'.`;
    console.log("AI prompt:", aiPrompt);

    const answer = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getAIAnswer", prompt: aiPrompt }, (response) => {
        if (response && response.answer && ['a', 'b', 'c', 'd'].includes(response.answer)) {
          console.log("Received AI answer:", response.answer);
          resolve(response.answer);
        } else {
          console.error("No valid response from AI. Defaulting to 'b'.");
          resolve("b");
        }
      });
    });

    console.log(`AI selected answer: ${answer}`);

    const selectedOption = options.find(opt => opt.letter === answer);
    if (selectedOption && selectedOption.input) {
      try {
        selectedOption.input.click();
        console.log(`Selected answer: ${answer} (label: ${selectedOption.label})`);
      } catch (error) {
        console.error(`Error clicking radio button for ${answer}: ${error.message}`);
        continue; 
      }
    } else {
      console.error(`No valid option found for answer ${answer}. Available options:`, options);
      continue; 
    }

    if (questionCount >= maxQuestions) {
      console.log("Reached maximum question limit.");
      return false;
    }
  }

  const nextButton = document.querySelector('input[value="Next page"][type="submit"]') || document.querySelector("#mod_quiz-next-nav");
  if (nextButton && questionCount < maxQuestions) {
    console.log("Clicking 'Next page' button...");
    nextButton.click();
    return true; 
  } else {
    console.log("No more pages or reached question limit.");
    return false;
  }
}

if (window.location.href.includes(`mod/quiz/view.php?id=${quizId}`)) {
  console.log("Page matches quiz URL. Attempting to start or continue quiz...");
  startQuizAttempt();
}

if (window.location.href.includes("mod/quiz/attempt.php")) {
  console.log("Page matches quiz attempt URL. Starting quiz processing...");
  processQuizLoop();
}
