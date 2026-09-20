/**
 * medical.js — the knowledge layer behind "UNDERSTAND".
 *
 * Deliberately a curated reference table rather than free-form model output.
 * A language model is excellent at phrasing and terrible at being accountable
 * for a number, so the number -> interpretation step is fixed here and only the
 * *wording* is ever a candidate for generation (see ai.js).
 *
 * Every entry carries: matching aliases, unit, reference band, direction of
 * concern, and an explanation written at roughly a class-6 reading level in
 * both English and Hindi.
 */

const ANALYTES = [
  {
    key: 'hba1c',
    label: 'HbA1c',
    labelHi: 'एचबीए1सी',
    aliases: ['hba1c', 'hb a1c', 'glycated haemoglobin', 'glycosylated hemoglobin', 'a1c'],
    unit: '%',
    low: 4.0,
    high: 5.7,
    borderlineHigh: 6.5,
    story: 'hba1c',
    what: {
      en: 'HbA1c is an average of your blood sugar over the last two to three months.',
      hi: 'एचबीए1सी पिछले दो-तीन महीनों में आपकी औसत शुगर बताता है।'
    },
    highMeans: {
      en: 'Your average blood sugar over the past three months has been higher than the usual target range.',
      hi: 'पिछले तीन महीनों में आपकी औसत शुगर सामान्य लक्ष्य से ऊपर रही है।'
    },
    lowMeans: {
      en: 'Your average blood sugar has been lower than the usual range.',
      hi: 'आपकी औसत शुगर सामान्य सीमा से कम रही है।'
    },
    normalMeans: {
      en: 'Your average blood sugar over the past three months is inside the usual range.',
      hi: 'पिछले तीन महीनों की आपकी औसत शुगर सामान्य सीमा में है।'
    },
    ask: {
      en: 'Ask your doctor whether your current treatment needs any adjustment.',
      hi: 'अपने डॉक्टर से पूछें कि क्या आपके इलाज में कोई बदलाव ज़रूरी है।'
    }
  },
  {
    key: 'fasting_glucose',
    label: 'Fasting blood sugar',
    labelHi: 'खाली पेट शुगर',
    aliases: ['fasting glucose', 'fasting blood sugar', 'fbs', 'glucose fasting', 'fasting plasma glucose'],
    unit: 'mg/dL',
    low: 70,
    high: 99,
    borderlineHigh: 126,
    story: 'glucose',
    what: {
      en: 'This is the sugar level in your blood after not eating overnight.',
      hi: 'यह रात भर कुछ न खाने के बाद आपके खून में शुगर का स्तर है।'
    },
    highMeans: {
      en: 'Your blood sugar before breakfast was higher than the usual range.',
      hi: 'नाश्ते से पहले आपकी शुगर सामान्य सीमा से ऊपर थी।'
    },
    lowMeans: {
      en: 'Your blood sugar before breakfast was lower than the usual range. Low sugar can make you feel shaky or dizzy.',
      hi: 'नाश्ते से पहले आपकी शुगर सामान्य से कम थी। कम शुगर से कमज़ोरी या चक्कर महसूस हो सकता है।'
    },
    normalMeans: {
      en: 'Your blood sugar before breakfast is inside the usual range.',
      hi: 'नाश्ते से पहले आपकी शुगर सामान्य सीमा में है।'
    },
    ask: {
      en: 'Share this reading with your doctor at your next visit.',
      hi: 'अगली मुलाक़ात पर यह रीडिंग अपने डॉक्टर को दिखाएँ।'
    }
  },
  {
    key: 'egfr',
    label: 'eGFR (kidney filtering)',
    labelHi: 'ईजीएफआर (गुर्दे की छनने की क्षमता)',
    aliases: ['egfr', 'gfr', 'estimated gfr', 'estimated glomerular filtration rate'],
    unit: 'mL/min/1.73m²',
    low: 90,
    high: 200,
    invert: true,
    story: 'kidney',
    what: {
      en: 'eGFR is an estimate of how well your kidneys are filtering waste out of your blood.',
      hi: 'ईजीएफआर बताता है कि आपके गुर्दे खून से गंदगी कितनी अच्छी तरह छान रहे हैं।'
    },
    lowMeans: {
      en: 'Your kidneys are filtering a little more slowly than the usual range. This number moves with hydration and age as well.',
      hi: 'आपके गुर्दे सामान्य से थोड़ा धीमे छान रहे हैं। यह संख्या पानी की मात्रा और उम्र से भी बदलती है।'
    },
    highMeans: {
      en: 'Your filtering rate is above the usual reported range.',
      hi: 'आपकी छनने की दर सामान्य दर्ज सीमा से ऊपर है।'
    },
    normalMeans: {
      en: 'Your kidney filtering rate is inside the usual range.',
      hi: 'आपके गुर्दे की छनने की दर सामान्य सीमा में है।'
    },
    ask: {
      en: 'Ask your doctor how often this should be rechecked.',
      hi: 'डॉक्टर से पूछें कि यह जाँच कितने समय बाद दोबारा करानी चाहिए।'
    }
  },
  {
    key: 'creatinine',
    label: 'Creatinine',
    labelHi: 'क्रिएटिनिन',
    aliases: ['creatinine', 'serum creatinine', 's. creatinine'],
    unit: 'mg/dL',
    low: 0.6,
    high: 1.3,
    story: 'kidney',
    what: {
      en: 'Creatinine is a waste product your kidneys clear out. It is another way of checking kidney work.',
      hi: 'क्रिएटिनिन एक अपशिष्ट है जिसे गुर्दे बाहर निकालते हैं। यह गुर्दे की जाँच का दूसरा तरीका है।'
    },
    highMeans: {
      en: 'More waste is staying in the blood than usual, which can mean the kidneys are working harder.',
      hi: 'खून में सामान्य से ज़्यादा अपशिष्ट रह रहा है, यानी गुर्दों पर ज़्यादा ज़ोर पड़ सकता है।'
    },
    lowMeans: {
      en: 'This value is below the usual range, which often relates to muscle mass rather than illness.',
      hi: 'यह मान सामान्य से कम है, जो अक्सर बीमारी नहीं बल्कि मांसपेशियों से जुड़ा होता है।'
    },
    normalMeans: {
      en: 'This waste level is inside the usual range.',
      hi: 'यह अपशिष्ट स्तर सामान्य सीमा में है।'
    },
    ask: {
      en: 'Your doctor reads this together with eGFR, not on its own.',
      hi: 'डॉक्टर इसे अकेले नहीं, ईजीएफआर के साथ देखते हैं।'
    }
  },
  {
    key: 'ldl',
    label: 'LDL cholesterol',
    labelHi: 'एलडीएल कोलेस्ट्रॉल',
    aliases: ['ldl', 'ldl cholesterol', 'ldl-c', 'low density lipoprotein'],
    unit: 'mg/dL',
    low: 0,
    high: 100,
    borderlineHigh: 130,
    story: 'cholesterol',
    what: {
      en: 'LDL is the cholesterol that can build up along the walls of blood vessels.',
      hi: 'एलडीएल वह कोलेस्ट्रॉल है जो खून की नलियों की दीवार पर जम सकता है।'
    },
    highMeans: {
      en: 'This type of cholesterol is above the usual target, which matters for heart health over the long run.',
      hi: 'यह कोलेस्ट्रॉल सामान्य लक्ष्य से ऊपर है, जो लंबे समय में हृदय के लिए मायने रखता है।'
    },
    lowMeans: { en: 'This value is below the usual target range.', hi: 'यह मान सामान्य लक्ष्य से नीचे है।' },
    normalMeans: { en: 'This cholesterol value is inside the usual target.', hi: 'यह कोलेस्ट्रॉल मान सामान्य लक्ष्य में है।' },
    ask: {
      en: 'Ask your doctor what target is right for you, since targets differ from person to person.',
      hi: 'डॉक्टर से पूछें कि आपके लिए सही लक्ष्य क्या है, क्योंकि यह हर व्यक्ति में अलग होता है।'
    }
  },
  {
    key: 'hdl',
    label: 'HDL cholesterol',
    labelHi: 'एचडीएल कोलेस्ट्रॉल',
    aliases: ['hdl', 'hdl cholesterol', 'hdl-c', 'high density lipoprotein'],
    unit: 'mg/dL',
    low: 40,
    high: 100,
    invert: true,
    story: 'cholesterol',
    what: {
      en: 'HDL is the cholesterol that helps carry other cholesterol away.',
      hi: 'एचडीएल वह कोलेस्ट्रॉल है जो दूसरे कोलेस्ट्रॉल को हटाने में मदद करता है।'
    },
    lowMeans: { en: 'This helpful cholesterol is below the usual range.', hi: 'यह उपयोगी कोलेस्ट्रॉल सामान्य सीमा से कम है।' },
    highMeans: { en: 'This helpful cholesterol is comfortably above the usual minimum.', hi: 'यह उपयोगी कोलेस्ट्रॉल सामान्य न्यूनतम से ऊपर है।' },
    normalMeans: { en: 'This helpful cholesterol is inside the usual range.', hi: 'यह उपयोगी कोलेस्ट्रॉल सामान्य सीमा में है।' },
    ask: { en: 'Walking and activity are commonly discussed with doctors for this value.', hi: 'इस मान के लिए डॉक्टर अक्सर चलने-फिरने की बात करते हैं।' }
  },
  {
    key: 'triglycerides',
    label: 'Triglycerides',
    labelHi: 'ट्राइग्लिसराइड्स',
    aliases: ['triglycerides', 'tg', 'serum triglycerides'],
    unit: 'mg/dL',
    low: 0,
    high: 150,
    story: 'cholesterol',
    what: { en: 'Triglycerides are fats carried in the blood.', hi: 'ट्राइग्लिसराइड्स खून में मौजूद चर्बी है।' },
    highMeans: { en: 'The fat level in your blood is above the usual range. Recent meals can affect this reading.', hi: 'खून में चर्बी सामान्य से ऊपर है। हाल का भोजन भी इस रीडिंग को बदल सकता है।' },
    lowMeans: { en: 'This value is below the usual range.', hi: 'यह मान सामान्य सीमा से कम है।' },
    normalMeans: { en: 'The fat level in your blood is inside the usual range.', hi: 'खून में चर्बी सामान्य सीमा में है।' },
    ask: { en: 'Check with your doctor whether this test was done fasting.', hi: 'डॉक्टर से पुष्टि करें कि यह जाँच खाली पेट हुई थी या नहीं।' }
  },
  {
    key: 'total_cholesterol',
    label: 'Total cholesterol',
    labelHi: 'कुल कोलेस्ट्रॉल',
    aliases: ['total cholesterol', 'cholesterol total', 'serum cholesterol'],
    unit: 'mg/dL',
    low: 0,
    high: 200,
    story: 'cholesterol',
    what: { en: 'This is all the cholesterol in your blood added together.', hi: 'यह आपके खून का कुल कोलेस्ट्रॉल है।' },
    highMeans: { en: 'The combined cholesterol figure is above the usual range.', hi: 'कुल कोलेस्ट्रॉल सामान्य सीमा से ऊपर है।' },
    lowMeans: { en: 'The combined cholesterol figure is below the usual range.', hi: 'कुल कोलेस्ट्रॉल सामान्य सीमा से कम है।' },
    normalMeans: { en: 'The combined cholesterol figure is inside the usual range.', hi: 'कुल कोलेस्ट्रॉल सामान्य सीमा में है।' },
    ask: { en: 'The split between LDL and HDL usually matters more than this single number.', hi: 'इस एक संख्या से ज़्यादा मायने एलडीएल और एचडीएल का अंतर रखता है।' }
  },
  {
    key: 'bp',
    label: 'Blood pressure',
    labelHi: 'रक्तचाप',
    aliases: ['blood pressure', 'bp', 'b.p.'],
    unit: 'mmHg',
    pair: true,
    low: 90,
    high: 130,
    story: 'bp',
    what: { en: 'Blood pressure is how hard blood pushes against the walls of your vessels.', hi: 'रक्तचाप बताता है कि खून नलियों की दीवार पर कितना ज़ोर डाल रहा है।' },
    highMeans: { en: 'The pushing force is above the usual target range.', hi: 'यह दबाव सामान्य लक्ष्य से ऊपर है।' },
    lowMeans: { en: 'The pushing force is below the usual range, which can cause dizziness on standing.', hi: 'यह दबाव सामान्य से कम है, जिससे खड़े होने पर चक्कर आ सकता है।' },
    normalMeans: { en: 'The pushing force is inside the usual target range.', hi: 'यह दबाव सामान्य लक्ष्य सीमा में है।' },
    ask: { en: 'One reading is only a snapshot. Doctors look at several readings across days.', hi: 'एक रीडिंग सिर्फ़ एक झलक है। डॉक्टर कई दिनों की रीडिंग देखते हैं।' }
  },
  {
    key: 'hemoglobin',
    label: 'Haemoglobin',
    labelHi: 'हीमोग्लोबिन',
    aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'],
    unit: 'g/dL',
    low: 12,
    high: 17,
    story: 'hemoglobin',
    what: { en: 'Haemoglobin carries oxygen from your lungs to the rest of your body.', hi: 'हीमोग्लोबिन फेफड़ों से शरीर तक ऑक्सीजन पहुँचाता है।' },
    lowMeans: { en: 'Your oxygen-carrying level is below the usual range, which often shows up as tiredness.', hi: 'ऑक्सीजन ले जाने की क्षमता सामान्य से कम है, जिससे अक्सर थकान लगती है।' },
    highMeans: { en: 'Your oxygen-carrying level is above the usual range.', hi: 'ऑक्सीजन ले जाने की क्षमता सामान्य से ऊपर है।' },
    normalMeans: { en: 'Your oxygen-carrying level is inside the usual range.', hi: 'ऑक्सीजन ले जाने की क्षमता सामान्य सीमा में है।' },
    ask: { en: 'Mention any unusual tiredness to your doctor along with this result.', hi: 'इस नतीजे के साथ असामान्य थकान की बात डॉक्टर को ज़रूर बताएँ।' }
  },
  {
    key: 'tsh',
    label: 'TSH (thyroid)',
    labelHi: 'टीएसएच (थायरॉइड)',
    aliases: ['tsh', 'thyroid stimulating hormone'],
    unit: 'µIU/mL',
    low: 0.4,
    high: 4.5,
    story: 'thyroid',
    what: { en: 'TSH is the signal your brain sends to the thyroid gland, which sets your body\u2019s pace.', hi: 'टीएसएच वह संकेत है जो दिमाग थायरॉइड ग्रंथि को भेजता है, जो शरीर की रफ़्तार तय करती है।' },
    highMeans: { en: 'The signal is stronger than usual, which can go with feeling slow or cold.', hi: 'यह संकेत सामान्य से तेज़ है, जिससे सुस्ती या ठंड लग सकती है।' },
    lowMeans: { en: 'The signal is weaker than usual, which can go with feeling restless or warm.', hi: 'यह संकेत सामान्य से कमज़ोर है, जिससे बेचैनी या गर्मी लग सकती है।' },
    normalMeans: { en: 'The thyroid signal is inside the usual range.', hi: 'थायरॉइड संकेत सामान्य सीमा में है।' },
    ask: { en: 'Thyroid results are usually read with your symptoms, not alone.', hi: 'थायरॉइड नतीजे आमतौर पर लक्षणों के साथ पढ़े जाते हैं।' }
  },
  {
    key: 'vitamin_d',
    label: 'Vitamin D',
    labelHi: 'विटामिन डी',
    aliases: ['vitamin d', 'vit d', '25-oh vitamin d', '25 hydroxy vitamin d'],
    unit: 'ng/mL',
    low: 30,
    high: 100,
    invert: true,
    story: 'vitamind',
    what: { en: 'Vitamin D helps your body use calcium to keep bones strong.', hi: 'विटामिन डी शरीर को कैल्शियम इस्तेमाल करने में मदद करता है ताकि हड्डियाँ मज़बूत रहें।' },
    lowMeans: { en: 'Your vitamin D is below the usual range. This is very common and is checked again after treatment.', hi: 'आपका विटामिन डी सामान्य से कम है। यह बहुत आम है और इलाज के बाद दोबारा जाँचा जाता है।' },
    highMeans: { en: 'Your vitamin D is above the usual range.', hi: 'आपका विटामिन डी सामान्य सीमा से ऊपर है।' },
    normalMeans: { en: 'Your vitamin D is inside the usual range.', hi: 'आपका विटामिन डी सामान्य सीमा में है।' },
    ask: { en: 'Any supplement dose should come from your doctor, not from an app.', hi: 'कोई भी सप्लीमेंट की खुराक ऐप से नहीं, डॉक्टर से तय होनी चाहिए।' }
  },
  {
    key: 'vitamin_b12',
    label: 'Vitamin B12',
    labelHi: 'विटामिन बी12',
    aliases: ['vitamin b12', 'b12', 'cobalamin'],
    unit: 'pg/mL',
    low: 200,
    high: 900,
    invert: true,
    story: 'b12',
    what: { en: 'Vitamin B12 keeps nerves and blood cells healthy.', hi: 'विटामिन बी12 नसों और रक्त कोशिकाओं को स्वस्थ रखता है।' },
    lowMeans: { en: 'Your B12 is below the usual range, which can go with tingling in hands or feet.', hi: 'आपका बी12 सामान्य से कम है, जिससे हाथ-पैर में झनझनाहट हो सकती है।' },
    highMeans: { en: 'Your B12 is above the usual range, which is common after supplements.', hi: 'आपका बी12 सामान्य से ऊपर है, जो सप्लीमेंट के बाद आम है।' },
    normalMeans: { en: 'Your B12 is inside the usual range.', hi: 'आपका बी12 सामान्य सीमा में है।' },
    ask: { en: 'Tell your doctor if you notice numbness or tingling.', hi: 'सुन्नपन या झनझनाहट हो तो डॉक्टर को बताएँ।' }
  },
  {
    key: 'uric_acid',
    label: 'Uric acid',
    labelHi: 'यूरिक एसिड',
    aliases: ['uric acid', 'serum uric acid'],
    unit: 'mg/dL',
    low: 3.5,
    high: 7.2,
    story: 'uric',
    what: { en: 'Uric acid is a waste product that can collect in joints when it builds up.', hi: 'यूरिक एसिड एक अपशिष्ट है जो ज़्यादा होने पर जोड़ों में जमा हो सकता है।' },
    highMeans: { en: 'This waste level is above the usual range, which is sometimes linked with joint pain.', hi: 'यह स्तर सामान्य से ऊपर है, जिसे कभी-कभी जोड़ों के दर्द से जोड़ा जाता है।' },
    lowMeans: { en: 'This waste level is below the usual range.', hi: 'यह स्तर सामान्य सीमा से कम है।' },
    normalMeans: { en: 'This waste level is inside the usual range.', hi: 'यह स्तर सामान्य सीमा में है।' },
    ask: { en: 'Ask your doctor before changing your diet based on this number.', hi: 'इस संख्या के आधार पर खानपान बदलने से पहले डॉक्टर से पूछें।' }
  },
  {
    key: 'potassium',
    label: 'Potassium',
    labelHi: 'पोटेशियम',
    aliases: ['potassium', 'k+', 'serum potassium'],
    unit: 'mmol/L',
    low: 3.5,
    high: 5.1,
    story: 'electrolyte',
    what: { en: 'Potassium is a mineral that helps your heart and muscles work steadily.', hi: 'पोटेशियम एक खनिज है जो दिल और मांसपेशियों को ठीक से चलाता है।' },
    highMeans: { en: 'This mineral is above the usual range. Doctors watch this one closely.', hi: 'यह खनिज सामान्य से ऊपर है। डॉक्टर इस पर ख़ास ध्यान देते हैं।' },
    lowMeans: { en: 'This mineral is below the usual range, which can cause muscle weakness or cramps.', hi: 'यह खनिज सामान्य से कम है, जिससे कमज़ोरी या ऐंठन हो सकती है।' },
    normalMeans: { en: 'This mineral is inside the usual range.', hi: 'यह खनिज सामान्य सीमा में है।' },
    ask: { en: 'Show this result to your doctor soon if it is outside the range.', hi: 'सीमा से बाहर हो तो यह नतीजा जल्दी डॉक्टर को दिखाएँ।' },
    priority: true
  },
  {
    key: 'sodium',
    label: 'Sodium',
    labelHi: 'सोडियम',
    aliases: ['sodium', 'na+', 'serum sodium'],
    unit: 'mmol/L',
    low: 135,
    high: 145,
    story: 'electrolyte',
    what: { en: 'Sodium is a mineral that controls the water balance in your body.', hi: 'सोडियम एक खनिज है जो शरीर में पानी का संतुलन रखता है।' },
    highMeans: { en: 'This mineral is above the usual range, often linked with drinking too little water.', hi: 'यह खनिज सामान्य से ऊपर है, अक्सर कम पानी पीने से जुड़ा होता है।' },
    lowMeans: { en: 'This mineral is below the usual range.', hi: 'यह खनिज सामान्य सीमा से कम है।' },
    normalMeans: { en: 'This mineral is inside the usual range.', hi: 'यह खनिज सामान्य सीमा में है।' },
    ask: { en: 'Your doctor reads this along with your other minerals.', hi: 'डॉक्टर इसे बाकी खनिजों के साथ देखते हैं।' }
  },
  {
    key: 'alt',
    label: 'SGPT / ALT (liver)',
    labelHi: 'एसजीपीटी / एएलटी (यकृत)',
    aliases: ['alt', 'sgpt', 'alanine aminotransferase'],
    unit: 'U/L',
    low: 7,
    high: 45,
    story: 'liver',
    what: { en: 'This is an enzyme from the liver. It rises when the liver is under strain.', hi: 'यह यकृत का एक एंज़ाइम है। यकृत पर दबाव पड़ने पर यह बढ़ता है।' },
    highMeans: { en: 'This liver value is above the usual range. Medicines and diet can both affect it.', hi: 'यह यकृत मान सामान्य से ऊपर है। दवाइयाँ और खानपान दोनों इसे बदल सकते हैं।' },
    lowMeans: { en: 'This liver value is below the usual range.', hi: 'यह यकृत मान सामान्य सीमा से कम है।' },
    normalMeans: { en: 'This liver value is inside the usual range.', hi: 'यह यकृत मान सामान्य सीमा में है।' },
    ask: { en: 'Tell your doctor about every medicine and supplement you take.', hi: 'अपनी सभी दवाइयाँ और सप्लीमेंट डॉक्टर को बताएँ।' }
  }
];

const BY_KEY = Object.fromEntries(ANALYTES.map((a) => [a.key, a]));

/** Classify a value against the reference band. */
function classify(analyte, value) {
  if (analyte.invert) {
    if (value < analyte.low) return 'low';
    return 'normal';
  }
  if (value > analyte.high) return 'high';
  if (value < analyte.low) return 'low';
  return 'normal';
}

/** Severity drives ordering and visual weight, never a diagnosis. */
function severity(analyte, value, status) {
  if (status === 'normal') return 'normal';
  const span = Math.max(analyte.high - analyte.low, 1);
  const distance = status === 'high' ? value - analyte.high : analyte.low - value;
  const ratio = distance / span;
  if (analyte.priority) return ratio > 0.05 ? 'attention' : 'watch';
  return ratio > 0.35 ? 'attention' : 'watch';
}

function explain(analyte, value, status, lang) {
  const L = lang === 'hi' ? 'hi' : 'en';
  let meaning;
  if (status === 'high') meaning = (analyte.highMeans || analyte.normalMeans)[L];
  else if (status === 'low') meaning = (analyte.lowMeans || analyte.normalMeans)[L];
  else meaning = analyte.normalMeans[L];
  return {
    what: analyte.what[L],
    meaning,
    ask: analyte.ask[L]
  };
}

function findAnalyte(name) {
  const n = String(name).toLowerCase().replace(/[^a-z0-9+ .]/g, ' ').replace(/\s+/g, ' ').trim();
  let best = null;
  for (const a of ANALYTES) {
    for (const alias of a.aliases) {
      if (n === alias) return a;
      if (n.includes(alias) && (!best || alias.length > best.matchLen)) {
        best = { analyte: a, matchLen: alias.length };
      }
    }
  }
  return best ? best.analyte : null;
}

module.exports = { ANALYTES, BY_KEY, classify, severity, explain, findAnalyte };
