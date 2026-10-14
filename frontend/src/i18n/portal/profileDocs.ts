import type { Rows } from './build';

// Profile, documents, review QR, calls.
const rows: Rows = {
  // documents
  'pw.doc.type.AADHAAR': ['Aadhaar', 'आधार', 'ஆதார்', 'ఆధార్'],
  'pw.doc.type.PAN': ['PAN Card', 'पैन कार्ड', 'பான் கார்டு', 'పాన్ కార్డ్'],
  'pw.doc.type.OFFER_LETTER': ['Offer Letter', 'ऑफर लेटर', 'வேலை வாய்ப்பு கடிதம்', 'ఆఫర్ లెటర్'],
  'pw.doc.type.EXPERIENCE_LETTER': ['Experience Letter', 'अनुभव पत्र', 'அனுபவச் சான்றிதழ்', 'అనుభవ పత్రం'],
  'pw.doc.type.EDUCATION': ['Education Certificate', 'शिक्षा प्रमाणपत्र', 'கல்விச் சான்றிதழ்', 'విద్యా సర్టిఫికేట్'],
  'pw.doc.type.BANK': ['Bank Proof', 'बैंक प्रमाण', 'வங்கி சான்று', 'బ్యాంక్ ప్రూఫ్'],
  'pw.doc.type.OTHER': ['Other', 'अन्य', 'பிற', 'ఇతర'],

  // review QR
  'pw.qr.loadFailed': ['Could not load your review QR', 'आपका रिव्यू QR लोड नहीं हो सका', 'உங்கள் மதிப்புரை QR-ஐ ஏற்ற முடியவில்லை', 'మీ రివ్యూ QR ను లోడ్ చేయలేకపోయాం'],
  'pw.qr.copied': ['Link copied', 'लिंक कॉपी हो गया', 'இணைப்பு நகலெடுக்கப்பட்டது', 'లింక్ కాపీ అయింది'],
  'pw.qr.copyFailed': ['Copy failed', 'कॉपी नहीं हो सका', 'நகலெடுக்க முடியவில்லை', 'కాపీ విఫలమైంది'],
  'pw.qr.shareText': ["We'd love your feedback! Please rate my service: {{link}}", 'हमें आपकी राय चाहिए! कृपया मेरी सेवा को रेट करें: {{link}}', 'உங்கள் கருத்தை அறிய விரும்புகிறோம்! எனது சேவையை மதிப்பிடவும்: {{link}}', 'మీ అభిప్రాయం మాకు కావాలి! దయచేసి నా సేవను రేట్ చేయండి: {{link}}'],
  'pw.qr.shareTitle': ['Leave a review', 'रिव्यू दें', 'மதிப்புரை எழுதுங்கள்', 'రివ్యూ ఇవ్వండి'],
  'pw.qr.title': ['My Review QR', 'मेरा रिव्यू QR', 'என் மதிப்புரை QR', 'నా రివ్యూ QR'],
  'pw.qr.intro': ["Show this to a customer to scan. They'll rate you and leave a message, then be sent to our Google review page.", 'ग्राहक को स्कैन करने के लिए यह दिखाएं। वे आपको रेट करेंगे और संदेश देंगे, फिर हमारे गूगल रिव्यू पेज पर जाएंगे।', 'வாடிக்கையாளர் ஸ்கேன் செய்ய இதைக் காட்டுங்கள். அவர்கள் உங்களை மதிப்பிட்டு செய்தி அனுப்பிய பின் எங்கள் கூகுள் மதிப்புரை பக்கத்திற்குச் செல்வார்கள்.', 'కస్టమర్ స్కాన్ చేయడానికి దీన్ని చూపించండి. వారు మిమ్మల్ని రేట్ చేసి సందేశం ఇచ్చాక మా గూగుల్ రివ్యూ పేజీకి వెళ్తారు.'],
  'pw.qr.save': ['Save QR', 'QR सहेजें', 'QR சேமி', 'QR సేవ్ చేయి'],
  'pw.qr.share': ['Share', 'साझा करें', 'பகிர்', 'షేర్'],
  'pw.qr.preview': ['Preview my review page', 'मेरा रिव्यू पेज देखें', 'என் மதிப்புரை பக்கத்தை முன்னோட்டம் பார்', 'నా రివ్యూ పేజీ ప్రివ్యూ చూడండి'],
  'pw.qr.reviews': ['{{count}} reviews', '{{count}} रिव्यू', '{{count}} மதிப்புரைகள்', '{{count}} రివ్యూలు'],
  'pw.qr.review1': ['1 review', '1 रिव्यू', '1 மதிப்புரை', '1 రివ్యూ'],
  'pw.qr.fromScans': ['from customer scans', 'ग्राहक स्कैन से', 'வாடிக்கையாளர் ஸ்கேன்களிலிருந்து', 'కస్టమర్ స్కాన్ల నుండి'],
  'pw.qr.noGoogle': ["Note: your company hasn't set a Google review link yet, so customers won't be redirected after reviewing.", 'ध्यान दें: आपकी कंपनी ने अभी गूगल रिव्यू लिंक सेट नहीं किया है, इसलिए रिव्यू के बाद ग्राहक आगे नहीं भेजे जाएंगे।', 'குறிப்பு: உங்கள் நிறுவனம் இன்னும் கூகுள் மதிப்புரை இணைப்பை அமைக்கவில்லை, எனவே மதிப்பிட்ட பின் வாடிக்கையாளர்கள் திருப்பிவிடப்பட மாட்டார்கள்.', 'గమనిక: మీ కంపెనీ ఇంకా గూగుల్ రివ్యూ లింక్ సెట్ చేయలేదు, కాబట్టి రివ్యూ తర్వాత కస్టమర్లు రీడైరెక్ట్ కారు.'],

  // calls
  'pw.calls.title': ['My Calls', 'मेरी कॉल', 'என் அழைப்புகள்', 'నా కాల్స్'],
  'pw.calls.subtitle': ['Upload a customer call — it becomes a Collect Requirement task for you.', 'ग्राहक की कॉल अपलोड करें — यह आपके लिए "आवश्यकता एकत्र करें" कार्य बन जाएगी।', 'வாடிக்கையாளர் அழைப்பைப் பதிவேற்றவும் — அது உங்களுக்கான "தேவையைச் சேகரி" பணியாக மாறும்.', 'కస్టమర్ కాల్‌ను అప్‌లోడ్ చేయండి — ఇది మీకు "అవసరాన్ని సేకరించండి" పనిగా మారుతుంది.'],
  'pw.calls.notePh': ['Note (optional) — what the customer asked, best time to call back…', 'नोट (वैकल्पिक) — ग्राहक ने क्या पूछा, वापस कॉल का सही समय…', 'குறிப்பு (விருப்பம்) — வாடிக்கையாளர் கேட்டது, மீண்டும் அழைக்க சிறந்த நேரம்…', 'గమనిక (ఐచ్ఛికం) — కస్టమర్ ఏమి అడిగారు, తిరిగి కాల్ చేయడానికి మంచి సమయం…'],
  'pw.calls.uploading': ['Uploading… {{p}}%', 'अपलोड हो रहा है… {{p}}%', 'பதிவேற்றுகிறது… {{p}}%', 'అప్‌లోడ్ అవుతోంది… {{p}}%'],
  'pw.calls.upload': ['Upload call recording', 'कॉल रिकॉर्डिंग अपलोड करें', 'அழைப்புப் பதிவை பதிவேற்று', 'కాల్ రికార్డింగ్ అప్‌లోడ్ చేయండి'],
  'pw.calls.hint': ["From your phone's call recordings (Files → Recordings / Call recordings).", 'आपके फ़ोन की कॉल रिकॉर्डिंग से (Files → Recordings / Call recordings)।', 'உங்கள் தொலைபேசியின் அழைப்புப் பதிவுகளிலிருந்து (Files → Recordings / Call recordings).', 'మీ ఫోన్ కాల్ రికార్డింగ్‌ల నుండి (Files → Recordings / Call recordings).'],
  'pw.calls.none': ['No calls yet.', 'अभी कोई कॉल नहीं।', 'இன்னும் அழைப்புகள் இல்லை.', 'ఇంకా కాల్స్ లేవు.'],
  'pw.calls.uploadedMany': ['{{n}} calls uploaded — tasks created for you', '{{n}} कॉल अपलोड हुईं — आपके लिए कार्य बन गए', '{{n}} அழைப்புகள் பதிவேற்றப்பட்டன — உங்களுக்கு பணிகள் உருவாக்கப்பட்டன', '{{n}} కాల్స్ అప్‌లోడ్ అయ్యాయి — మీకు పనులు సృష్టించబడ్డాయి'],
  'pw.calls.uploadedOne': ['Call uploaded — task created for you', 'कॉल अपलोड हुई — आपके लिए कार्य बन गया', 'அழைப்பு பதிவேற்றப்பட்டது — உங்களுக்கு பணி உருவாக்கப்பட்டது', 'కాల్ అప్‌లోడ్ అయింది — మీకు పని సృష్టించబడింది'],
  'pw.calls.uploadFailed': ['Could not upload the call.', 'कॉल अपलोड नहीं हो सकी।', 'அழைப்பைப் பதிவேற்ற முடியவில்லை.', 'కాల్‌ను అప్‌లోడ్ చేయలేకపోయాం.'],
  'pw.calls.unknown': ['Unknown number', 'अज्ञात नंबर', 'தெரியாத எண்', 'తెలియని నంబర్'],
  'pw.calls.incoming': ['Incoming', 'आने वाली', 'உள்வரும்', 'ఇన్‌కమింగ్'],
  'pw.calls.outgoing': ['Outgoing', 'जाने वाली', 'வெளிச்செல்லும்', 'అవుట్‌గోయింగ్'],
  'pw.calls.collect': ['Collect requirement', 'आवश्यकता एकत्र करें', 'தேவையைச் சேகரி', 'అవసరాన్ని సేకరించండి'],
  'pw.calls.openTask': ['Open task', 'कार्य खोलें', 'பணியைத் திற', 'పనిని తెరవండి'],
  'pw.calls.notLead': ['Not a lead', 'लीड नहीं', 'லீட் அல்ல', 'లీడ్ కాదు'],
  'pw.calls.leadCreated': ['Lead created', 'लीड बनी', 'லீட் உருவாக்கப்பட்டது', 'లీడ్ సృష్టించబడింది'],
  'pw.calls.addedToLead': ['Added to lead', 'लीड में जोड़ी गई', 'லீடில் சேர்க்கப்பட்டது', 'లీడ్‌కు జోడించబడింది'],
  'pw.calls.todo': ['To do', 'करना है', 'செய்ய வேண்டும்', 'చేయాల్సినది'],
};
export default rows;
