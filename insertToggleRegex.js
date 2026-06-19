const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\My App\\Quran Classes Tracker', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Match the comment "WhatsApp Toggle & Subscription Counter" and the div
const regex = /(\{\/\*\s*WhatsApp Toggle & Subscription Counter - Compact Row\s*\*\/\}\s*<div className="flex items-center justify-center flex-wrap gap-3 mb-2">\s*)(<label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-700\/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">\s*<input\s*type="checkbox"\s*checked=\{subscriptionSettings\[smartReportModal\.studentId\]\?\.enabled \|\| false\})/m;

const insertStr = `$1<label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                        <input
                          type="checkbox"
                          checked={sendViaWhatsapp}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setSendViaWhatsapp(isChecked);
                            setLastReports(prev => {
                              const studentId = smartReportModal?.studentId;
                              if (!studentId) return prev;
                              return {
                                ...prev,
                                [studentId]: {
                                  ...prev[studentId],
                                  sendViaWhatsapp: isChecked
                                }
                              };
                            });
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-base font-medium text-gray-700 dark:text-gray-200">إرسال عبر واتساب</span>
                      </label>\n                      $2`;

if (regex.test(content)) {
  content = content.replace(regex, insertStr);
  fs.writeFileSync(filePath, content);
  console.log('Successfully inserted WhatsApp toggle.');
} else {
  console.log('Target string not found.');
}
