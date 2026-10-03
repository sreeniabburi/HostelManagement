export function parseCsvRecords(text: string, expectedHeaders: readonly string[]) {
  if (text.length > 2_000_000) throw new Error('Each CSV file must be smaller than 2 MB.')

  const input = text.replace(/^\uFEFF/, '')
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else if (character === '\r' && input[index + 1] === '\n') {
        field += '\n'
        index += 1
      } else {
        field += character
      }
    } else if (character === '"') {
      if (field.length) throw new Error(`Unexpected quote near character ${index + 1}.`)
      quoted = true
    } else if (character === ',') {
      record.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      record.push(field)
      if (record.some((value) => value.trim())) records.push(record)
      record = []
      field = ''
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('The CSV file ends inside a quoted field.')
  record.push(field)
  if (record.some((value) => value.trim())) records.push(record)
  if (!records.length) throw new Error('The CSV file is empty.')

  const headers = records[0].map((header) => header.trim())
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) {
    throw new Error('CSV column names must be non-empty and unique.')
  }
  if (headers.length !== expectedHeaders.length || expectedHeaders.some((header) => !headers.includes(header))) {
    throw new Error(`CSV columns must be: ${expectedHeaders.join(', ')}.`)
  }

  return records.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2} has ${values.length} columns; expected ${headers.length}.`)
    return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]))
  })
}
