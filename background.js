chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAIAnswer") {
      getAIAnswer(request.prompt).then((answer) => {
        sendResponse({ answer });
      });
      return true; 
    } else if (request.action === "startQuiz") {
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        function: () => {
          chrome.runtime.sendMessage({ action: "startQuiz" });
        },
      });
    }
  });
  
  async function getAIAnswer(prompt) {
    const apiKey = "AIzaSyB43n_ZMgajhuPxyKegvuT3UTPko5B4iLo";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
    };
  
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
  
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      const aiResponse = data.candidates[0].content.parts[0].text.trim().toLowerCase();
      return ["a", "b", "c", "d"].includes(aiResponse) ? aiResponse : "d";
    } catch (error) {
      console.error("Error fetching AI answer:", error.message);
      return "d"; 
    }
  }