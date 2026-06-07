const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log("Gemini key loaded:", !!process.env.GEMINI_API_KEY);
exports.explainQuestion = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        error: 'Question is required'
      });
    }

    if (!GEMINI_API_KEY) {
      console.error('Gemini API key missing in .env');
      return res.status(500).json({
        error: 'Gemini API key is not configured'
      });
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
     const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite'
    });


    // const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // const model = genAI.getGenerativeModel({
    //   model: 'gemini-2.0-flash'
    // });

    const prompt = `
Explain the following in very simple student-friendly English.

Rules:
- Keep answer under 5 lines
- Be concise
- Be easy to understand

Question:
${question}
`;

    const result = await model.generateContent(prompt);

    const response = result.response.text();

    return res.json({
      answer: response.trim()
    });

  } catch (error) {
    console.error('AI explain error:', error);

    return res.status(500).json({
      error: error.message || 'Unable to generate AI answer'
    });
  }
};