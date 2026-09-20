/**
 * storycare.js — the "LEARN" pillar.
 *
 * A medical concept is mapped to an analogy from ordinary household life,
 * then to a short three-beat story: the picture, the mechanism, and why the
 * treatment matters. The analogies are curated because a wrong analogy is a
 * wrong mental model, and a wrong mental model is a safety problem.
 */

const STORIES = {
  bp: {
    concept: { en: 'Blood pressure', hi: 'रक्तचाप' },
    icon: 'hose',
    picture: {
      en: 'Think of your blood vessels as the garden hose you use in the courtyard.',
      hi: 'अपनी खून की नलियों को आँगन वाले पाइप की तरह सोचिए।'
    },
    mechanism: {
      en: 'If the hose gets narrow or stiff, the water has to push much harder to get through. When blood vessels become narrow or stiff, the heart has to push blood with more force.',
      hi: 'अगर पाइप पतला या सख़्त हो जाए तो पानी को ज़्यादा ज़ोर लगाना पड़ता है। इसी तरह नलियाँ पतली या सख़्त होने पर दिल को खून ज़्यादा ज़ोर से भेजना पड़ता है।'
    },
    why: {
      en: 'Blood pressure medicine helps the vessels relax, so the heart does not have to push so hard every minute of the day.',
      hi: 'रक्तचाप की दवा नलियों को ढीला करने में मदद करती है, ताकि दिल को हर पल इतना ज़ोर न लगाना पड़े।'
    }
  },
  hba1c: {
    concept: { en: 'HbA1c', hi: 'एचबीए1सी' },
    icon: 'ledger',
    picture: {
      en: 'Think of HbA1c as the shopkeeper\u2019s account book, not today\u2019s bill.',
      hi: 'एचबीए1सी को आज के बिल की नहीं, दुकानदार की बही-खाते की तरह समझिए।'
    },
    mechanism: {
      en: 'A single sugar test is one day\u2019s bill. HbA1c adds up roughly three months of entries, so one sweet festival day cannot hide a habit and one careful day cannot fix one.',
      hi: 'एक बार की शुगर जाँच एक दिन का बिल है। एचबीए1सी लगभग तीन महीनों का हिसाब जोड़ता है, इसलिए एक त्योहार का दिन आदत को छिपा नहीं सकता और एक संभला दिन उसे सुधार नहीं सकता।'
    },
    why: {
      en: 'That is why doctors use this number to judge whether the whole treatment plan is working, not just one morning.',
      hi: 'इसीलिए डॉक्टर इस संख्या से पूरे इलाज का असर देखते हैं, सिर्फ़ एक सुबह का नहीं।'
    }
  },
  glucose: {
    concept: { en: 'Blood sugar', hi: 'रक्त शर्करा' },
    icon: 'tea',
    picture: {
      en: 'Think of sugar in the blood like sugar stirred into tea.',
      hi: 'खून की शुगर को चाय में घुली चीनी की तरह सोचिए।'
    },
    mechanism: {
      en: 'The body has a helper called insulin whose job is to move that sugar out of the cup and into the muscles, where it becomes energy. When the helper is short or tired, sugar stays in the cup.',
      hi: 'शरीर में इंसुलिन नाम का सहायक होता है जो उस शुगर को कप से निकालकर मांसपेशियों तक पहुँचाता है, जहाँ वह ऊर्जा बनती है। सहायक कम या थका हो तो शुगर कप में ही रह जाती है।'
    },
    why: {
      en: 'Diabetes medicines work on that helper or on how much sugar arrives, which is why the timing of the dose with meals matters.',
      hi: 'शुगर की दवाइयाँ उसी सहायक पर या शुगर की मात्रा पर काम करती हैं, इसीलिए खाने के साथ दवा का समय मायने रखता है।'
    }
  },
  kidney: {
    concept: { en: 'Kidney function', hi: 'गुर्दे का काम' },
    icon: 'filter',
    picture: {
      en: 'Think of your kidneys as the water filter in the kitchen.',
      hi: 'अपने गुर्दों को रसोई के पानी के फ़िल्टर की तरह सोचिए।'
    },
    mechanism: {
      en: 'A fresh filter cleans a full jug quickly. As the filter gets older or clogged, the same jug takes longer. The eGFR number is simply how fast the filter is working today.',
      hi: 'नया फ़िल्टर पूरी जग जल्दी साफ़ करता है। पुराना या जमा हुआ फ़िल्टर उतनी ही जग में ज़्यादा समय लेता है। ईजीएफआर बस यही बताता है कि फ़िल्टर आज कितनी तेज़ी से काम कर रहा है।'
    },
    why: {
      en: 'Doctors protect the filter with blood pressure control, enough water, and care with painkillers, because a filter is easier to protect than to repair.',
      hi: 'डॉक्टर रक्तचाप संभालकर, पर्याप्त पानी और दर्द की दवाइयों में सावधानी से इस फ़िल्टर की रक्षा करते हैं, क्योंकि फ़िल्टर को बचाना उसे सुधारने से आसान है।'
    }
  },
  cholesterol: {
    concept: { en: 'Cholesterol', hi: 'कोलेस्ट्रॉल' },
    icon: 'pipe',
    picture: {
      en: 'Think of the kitchen drain pipe after months of washing oily vessels.',
      hi: 'महीनों तक तेल वाले बर्तन धोने के बाद रसोई की नाली के पाइप को सोचिए।'
    },
    mechanism: {
      en: 'A thin layer of grease settles along the inside wall a little at a time. Nothing happens on any single day, but over years the opening narrows.',
      hi: 'थोड़ा-थोड़ा करके चिकनाई की परत अंदर की दीवार पर जमती जाती है। किसी एक दिन कुछ नहीं होता, लेकिन सालों में रास्ता सँकरा हो जाता है।'
    },
    why: {
      en: 'Cholesterol treatment is about slowing that slow settling, which is why it is taken steadily even when you feel completely fine.',
      hi: 'कोलेस्ट्रॉल का इलाज उसी धीमी जमावट को रोकने के लिए है, इसीलिए बिलकुल ठीक महसूस होने पर भी दवा नियमित ली जाती है।'
    }
  },
  hemoglobin: {
    concept: { en: 'Haemoglobin', hi: 'हीमोग्लोबिन' },
    icon: 'truck',
    picture: {
      en: 'Think of haemoglobin as the delivery vans that carry oxygen around your body.',
      hi: 'हीमोग्लोबिन को उन गाड़ियों की तरह सोचिए जो शरीर में ऑक्सीजन पहुँचाती हैं।'
    },
    mechanism: {
      en: 'The lungs load every van with oxygen and send it to the muscles and the brain. With fewer vans on the road, the same work leaves you more tired, and stairs feel longer than they used to.',
      hi: 'फेफड़े हर गाड़ी में ऑक्सीजन भरकर मांसपेशियों और दिमाग़ तक भेजते हैं। सड़क पर गाड़ियाँ कम हों तो वही काम ज़्यादा थकाता है और सीढ़ियाँ लंबी लगती हैं।'
    },
    why: {
      en: 'That is why doctors ask about tiredness along with this test, and look for the reason behind the shortage instead of only topping it up.',
      hi: 'इसीलिए डॉक्टर इस जाँच के साथ थकान के बारे में पूछते हैं और सिर्फ़ भरपाई नहीं, कमी का कारण भी ढूँढ़ते हैं।'
    }
  },
  thyroid: {
    concept: { en: 'Thyroid', hi: 'थायरॉइड' },
    icon: 'thermostat',
    picture: {
      en: 'Think of the thyroid gland as the regulator knob on a ceiling fan.',
      hi: 'थायरॉइड ग्रंथि को पंखे के रेगुलेटर की तरह सोचिए।'
    },
    mechanism: {
      en: 'It sets the speed at which the whole body runs. Turned too low, everything feels slow, heavy and cold. Turned too high, the body races, and you feel restless and warm.',
      hi: 'यह तय करती है कि पूरा शरीर किस रफ़्तार से चले। बहुत धीमा हो तो सब सुस्त, भारी और ठंडा लगता है। बहुत तेज़ हो तो शरीर दौड़ता है और बेचैनी और गर्मी लगती है।'
    },
    why: {
      en: 'Thyroid tablets nudge that knob back to the middle, so the dose is adjusted slowly and rechecked with a blood test.',
      hi: 'थायरॉइड की गोलियाँ उस रेगुलेटर को बीच में लाती हैं, इसलिए खुराक धीरे-धीरे बदली जाती है और खून की जाँच से दोबारा देखी जाती है।'
    }
  },
  vitamind: {
    concept: { en: 'Vitamin D', hi: 'विटामिन डी' },
    icon: 'bricks',
    picture: {
      en: 'Think of calcium as the bricks of your bones and vitamin D as the mason who lays them.',
      hi: 'कैल्शियम को हड्डियों की ईंट और विटामिन डी को उन्हें जोड़ने वाले राजमिस्त्री की तरह सोचिए।'
    },
    mechanism: {
      en: 'You can order a truckload of bricks, but with no mason on site the wall does not get built. Without enough vitamin D, the body cannot use the calcium it already has.',
      hi: 'ईंटों की पूरी गाड़ी मँगवा लीजिए, पर राजमिस्त्री न हो तो दीवार नहीं बनती। विटामिन डी कम हो तो शरीर मौजूद कैल्शियम का इस्तेमाल नहीं कर पाता।'
    },
    why: {
      en: 'This is why doctors often correct vitamin D alongside calcium, and why some morning sunlight is part of the advice.',
      hi: 'इसीलिए डॉक्टर अक्सर कैल्शियम के साथ विटामिन डी भी सुधारते हैं, और सुबह की धूप की सलाह देते हैं।'
    }
  },
  b12: {
    concept: { en: 'Vitamin B12', hi: 'विटामिन बी12' },
    icon: 'wire',
    picture: {
      en: 'Think of your nerves as electrical wires, each wrapped in insulation.',
      hi: 'अपनी नसों को बिजली के तारों की तरह सोचिए, हर तार पर एक परत चढ़ी होती है।'
    },
    mechanism: {
      en: 'Vitamin B12 helps maintain that wrapping. When the wrapping thins, the signal leaks, and that leak is felt as tingling or numbness in the hands and feet.',
      hi: 'विटामिन बी12 उस परत को बनाए रखता है। परत पतली होने पर संकेत रिसने लगता है, और यही रिसाव हाथ-पैरों में झनझनाहट या सुन्नपन की तरह महसूस होता है।'
    },
    why: {
      en: 'Correcting B12 early matters because wiring is easier to maintain than to repair.',
      hi: 'बी12 को जल्दी सुधारना ज़रूरी है, क्योंकि तार को बनाए रखना उसे सुधारने से आसान है।'
    }
  },
  uric: {
    concept: { en: 'Uric acid', hi: 'यूरिक एसिड' },
    icon: 'sand',
    picture: {
      en: 'Think of uric acid as fine sand carried in water.',
      hi: 'यूरिक एसिड को पानी में बहती बारीक रेत की तरह सोचिए।'
    },
    mechanism: {
      en: 'While there is plenty of water the sand stays floating. When there is too much sand for the water, it settles in the quiet corners, and in the body those corners are the joints, most often the big toe.',
      hi: 'पानी भरपूर हो तो रेत बहती रहती है। रेत ज़्यादा हो जाए तो शांत कोनों में बैठ जाती है, और शरीर में वे कोने जोड़ हैं, अक्सर पैर का अंगूठा।'
    },
    why: {
      en: 'Doctors use water, diet and sometimes medicine to keep the sand moving instead of settling.',
      hi: 'डॉक्टर पानी, खानपान और कभी-कभी दवा से उस रेत को जमने नहीं, बहते रहने देते हैं।'
    }
  },
  liver: {
    concept: { en: 'Liver enzymes', hi: 'यकृत एंज़ाइम' },
    icon: 'kitchen',
    picture: {
      en: 'Think of the liver as the kitchen of the body, where everything you swallow is processed.',
      hi: 'यकृत को शरीर की रसोई समझिए, जहाँ खाया-पिया सब कुछ तैयार होता है।'
    },
    mechanism: {
      en: 'When that kitchen is overworked, a little smoke escapes into the house. These enzyme numbers are that smoke: they signal strain, not fire.',
      hi: 'जब यह रसोई ज़्यादा काम करती है तो थोड़ा धुआँ घर में फैलता है। ये एंज़ाइम की संख्याएँ वही धुआँ हैं: वे दबाव बताती हैं, आग नहीं।'
    },
    why: {
      en: 'Because medicines are processed in this kitchen too, your doctor needs the full list of what you take.',
      hi: 'दवाइयाँ भी इसी रसोई में पचती हैं, इसलिए डॉक्टर को आपकी सारी दवाइयों की सूची चाहिए।'
    }
  },
  electrolyte: {
    concept: { en: 'Minerals in the blood', hi: 'खून के खनिज' },
    icon: 'salt',
    picture: {
      en: 'Think of these minerals as the salt in dal.',
      hi: 'इन खनिजों को दाल के नमक की तरह सोचिए।'
    },
    mechanism: {
      en: 'The exact amount is what matters, not more and not less. Too little and the body feels weak and crampy, too much and the heart\u2019s rhythm can be disturbed.',
      hi: 'सही मात्रा ही मायने रखती है, न ज़्यादा न कम। कम हो तो शरीर कमज़ोर और ऐंठन भरा लगता है, ज़्यादा हो तो दिल की धड़कन गड़बड़ हो सकती है।'
    },
    why: {
      en: 'This is why doctors take these numbers seriously even when you feel normal, and why water tablets are reviewed often.',
      hi: 'इसीलिए ठीक महसूस होने पर भी डॉक्टर इन संख्याओं को गंभीरता से लेते हैं, और पेशाब की दवाओं की समीक्षा बार-बार करते हैं।'
    }
  },
  adherence: {
    concept: { en: 'Taking medicine on time', hi: 'समय पर दवा लेना' },
    icon: 'watering',
    picture: {
      en: 'Think of your daily medicine like watering a plant on the balcony.',
      hi: 'रोज़ की दवा को बालकनी के पौधे को पानी देने जैसा समझिए।'
    },
    mechanism: {
      en: 'Watering it twice on Sunday does not make up for four dry days. The plant needs a small amount, regularly. Medicine keeps a steady level in the blood the same way.',
      hi: 'रविवार को दो बार पानी देने से चार सूखे दिनों की भरपाई नहीं होती। पौधे को थोड़ा, पर नियमित चाहिए। दवा भी इसी तरह खून में एक स्थिर स्तर बनाए रखती है।'
    },
    why: {
      en: 'That is why a missed evening dose is worth mentioning to your doctor rather than doubling the next one.',
      hi: 'इसीलिए छूटी हुई शाम की खुराक अगली बार दुगनी करने के बजाय डॉक्टर को बतानी चाहिए।'
    }
  }
};

function getStory(key, lang) {
  const s = STORIES[key];
  if (!s) return null;
  const L = lang === 'hi' ? 'hi' : 'en';
  return {
    key,
    icon: s.icon,
    concept: s.concept[L],
    picture: s.picture[L],
    mechanism: s.mechanism[L],
    why: s.why[L]
  };
}

function listStories(lang) {
  return Object.keys(STORIES).map((k) => getStory(k, lang));
}

/** Free-text concept -> story, used by the "explain a word" box. */
function matchStory(text) {
  const t = String(text).toLowerCase();
  const table = [
    [/blood pressure|bp|hypertension|pressure|रक्तचाप|बीपी/, 'bp'],
    [/hba1c|a1c|एचबीए/, 'hba1c'],
    [/sugar|glucose|diabet|शुगर|मधुमेह/, 'glucose'],
    [/kidney|renal|egfr|creatinine|गुर्द|किडनी/, 'kidney'],
    [/cholesterol|lipid|ldl|hdl|triglyc|कोलेस्ट्र/, 'cholesterol'],
    [/h(a)?emoglobin|anemia|anaemia|हीमोग्लोबिन|खून की कमी/, 'hemoglobin'],
    [/thyroid|tsh|थायरॉइड/, 'thyroid'],
    [/vitamin d|calcium|bone|विटामिन डी|हड्डी/, 'vitamind'],
    [/b12|cobalamin|बी12|झनझन/, 'b12'],
    [/uric|gout|यूरिक/, 'uric'],
    [/liver|sgpt|alt|sgot|यकृत|लिवर/, 'liver'],
    [/sodium|potassium|electrolyte|सोडियम|पोटेशियम/, 'electrolyte'],
    [/adherence|missed dose|on time|routine|नियमित|समय पर/, 'adherence']
  ];
  for (const [re, key] of table) if (re.test(t)) return key;
  return null;
}

module.exports = { STORIES, getStory, listStories, matchStory };
