// Strings for the picture and the page. Traditional Chinese first, English second.

export const LANGS = ['zh', 'en']

export function pickLang(tag) {
  return /^zh/i.test(tag ?? '') ? 'zh' : 'en'
}

export const poster = {
  zh: {
    title: '我們的織布',
    rowsAreDays: '每列一天，每格一小時',
    hours: (h) => `${h} 時`,
    scale: '每小時則數',
    span: (start, end, days) => `${start} 至 ${end}，共 ${days} 天`,
    coverage: (records, shown, total) => `${records.toLocaleString('en-US')} 則紀錄。取自匯出檔 ${total} 天中的最後 ${shown} 天`,
    coverageAll: (records, total) => `${records.toLocaleString('en-US')} 則紀錄，涵蓋匯出檔全部 ${total} 天`,
    coverageEarlier: (records, shown, total) => `${records.toLocaleString('en-US')} 則紀錄。取自匯出檔 ${total} 天中的 ${shown} 天`,
    blank: '空白代表這份檔案沒有紀錄，不代表沒聊天。',
    empty: '這段期間沒有紀錄',
  },
  en: {
    title: 'Our weave',
    rowsAreDays: 'One row a day, one cell an hour',
    hours: (h) => `${h}h`,
    scale: 'Messages per hour',
    span: (start, end, days) => `${start} to ${end}, ${days} days`,
    coverage: (records, shown, total) => `${records.toLocaleString('en-US')} records. The last ${shown} of ${total} days in the export`,
    coverageAll: (records, total) => `${records.toLocaleString('en-US')} records across all ${total} days in the export`,
    coverageEarlier: (records, shown, total) => `${records.toLocaleString('en-US')} records. ${shown} of ${total} days in the export`,
    blank: 'Blank means no records in this file, not that nobody talked.',
    empty: 'No records in this period',
  },
}
