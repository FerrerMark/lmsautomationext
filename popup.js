document.getElementById("startQuiz").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      console.log("Active tab URL:", tab.url);
  
      chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Content script not responding:", chrome.runtime.lastError.message);
          console.log("Tab details:", tab);
          alert("Content script is not active. Please ensure the extension is loaded and try again.");
          return;
        }
  
        if (response && response.pong) {
          console.log("Content script is active. Starting quiz...");
          // Proceed with starting the quiz
          chrome.tabs.sendMessage(tab.id, { action: "startQuiz" }, (startResponse) => {
            if (chrome.runtime.lastError) {
              console.error("Error sending startQuiz message:", chrome.runtime.lastError.message);
              alert("Failed to start quiz. Please try again.");
              return;
            }
  
            if (startResponse && startResponse.started) {
              chrome.tabs.sendMessage(tab.id, { action: "processPage" }, (processResponse) => {
                if (chrome.runtime.lastError) {
                  console.error("Error sending processPage message:", chrome.runtime.lastError.message);
                  return;
                }
  
                if (processResponse && processResponse.started) {
                  console.log("Quiz processing started. Check the page console for progress.");
                  alert("Quiz processing started! Check the page console for progress.");
                }
              });
            }
          });
        } else {
          console.error("Content script did not respond with expected pong message.");
          alert("Content script is not responding. Please refresh the page and try again.");
        }
      });
    });
  });
