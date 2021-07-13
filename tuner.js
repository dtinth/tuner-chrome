/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('canvas')
/** @type {HTMLCanvasElement} */
const historyCanvas = document.getElementById('historyCanvas')
const ctx = canvas.getContext('2d')
const hctx = historyCanvas.getContext('2d')
let note = 0

function ftom(f) {
  return 69 + (12.0 * Math.log(f / 440)) / Math.log(2)
}
const historyData = []
const pitchClasses = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
]

function updatePitch(analyserNode, detector, input, sampleRate) {
  analyserNode.getFloatTimeDomainData(input)
  const [pitch, clarity] = detector.findPitch(input, sampleRate)
  const fnote = ftom(pitch)
  const width = canvas.width
  const height = canvas.height

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fff'

  if (Number.isFinite(fnote) && !isNaN(fnote)) {
    if (Math.abs(fnote - note) < 1) {
      note += (fnote - note) / 5
    } else {
      note = fnote
    }
  }

  const getY = (note) => 300 - (note * 45) / 2
  ctx.fillStyle = '#fff2'
  for (let i = 0; i <= 12; i++) {
    ctx.fillRect(0, getY(i) - 1, width, 2)
    ctx.font = '12px sans-serif'
    ctx.fillText(`${pitchClasses[i % 12]}`, 32, getY(i) - 4)
  }
  ctx.font = '32px sans-serif'

  if (clarity >= 0.9) {
    const o = (clarity - 0.9) / 0.1
    const p = note % 12
    const closestNote = Math.round(note)
    const octave = Math.floor(note / 12) - 2
    let pitchClass = closestNote % 12
    if (pitchClass >= 12) pitchClass -= 12
    if (pitchClass < 0) pitchClass += 12
    const name = pitchClasses[pitchClass]

    ctx.save()
    ctx.fillStyle = '#d7fc70'
    for (let i = 0; i < 12; i++) {
      let dist = p - i
      if (dist > 6) dist -= 12
      if (dist < -6) dist += 12
      dist = Math.abs(dist)
      if (dist < 0.5) {
        ctx.globalAlpha = (1 - dist / 0.5) * o
        ctx.fillRect(0, getY(i) - 1, width, 2)
      }
    }
    ctx.restore()

    ctx.save()
    ctx.fillStyle = '#bef'
    for (let i = -1; i <= 1; i++) {
      const y = getY(p + 12 * i)
      const yR = getY(Math.round(p) + 12 * i)

      ctx.globalAlpha = o * (1 - Math.abs(p - Math.round(p)) / 0.5)
      ctx.fillRect(280, Math.min(y, yR) - 1, width - 280, Math.abs(y - yR) + 2)

      ctx.globalAlpha = o
      ctx.fillRect(280, y - 1, width - 280, 2)
      ctx.fillText(`${name}${octave}`, 290, y - 8)
    }
    ctx.restore()
    historyData.push(note)
  } else {
    historyData.push(null)
  }

  if (historyData.length > 560 / 3) {
    historyData.shift()
  }
  ctx.save()
  ctx.strokeStyle = '#bef'
  ctx.lineWidth = 2

  const strokes = []
  const active = {}

  for (let i = 0; i < historyData.length; i++) {
    let x = 280 - (historyData.length - i - 1) * 3
    const used = new Set()
    if (historyData[i] != null) {
      for (let octave = -1; octave <= 1; octave++) {
        const octaveNumber = Math.floor(historyData[i] / 12) + octave
        let y = getY(historyData[i] - 12 * octaveNumber)
        let activeStroke = active[octaveNumber]
        if (!activeStroke) {
          activeStroke = active[octaveNumber] = { octaveNumber, line: [] }
          strokes.push(activeStroke)
        }
        activeStroke.line.push({ x, y })
        used.add(octaveNumber)
      }
    }
    for (const key of Object.keys(active)) {
      if (!used.has(active[key].octaveNumber)) {
        delete active[key]
      }
    }
  }
  for (const stroke of strokes) {
    if (stroke.line.length > 1) {
      ctx.beginPath()
      ctx.moveTo(stroke.line[0].x, stroke.line[0].y)
      for (let i = 1; i < stroke.line.length; i++) {
        ctx.lineTo(stroke.line[i].x, stroke.line[i].y)
      }
      ctx.stroke()
    }
  }
  ctx.restore()

  setTimeout(() => updatePitch(analyserNode, detector, input, sampleRate), 16)
}

const getStream = async () => {
  const request = () =>
    navigator.mediaDevices.getUserMedia({
      audio: { autoGainControl: false },
    })
  try {
    const stream = await request()
    return stream
  } catch (e) {
    const grant = () =>
      chrome.tabs.create({
        url: chrome.runtime.getURL('grant.html'),
      })
    document.querySelector('#micNeeded').hidden = false
    document.querySelector('#grant').onclick = () => {
      grant()
    }
    grant()
  }
}

const start = async () => {
  const stream = await getStream()
  const audioContext = new window.AudioContext()
  audioContext.resume()
  const analyserNode = audioContext.createAnalyser()
  let sourceNode = audioContext.createMediaStreamSource(stream)
  sourceNode.connect(analyserNode)
  const detector = pitchy.PitchDetector.forFloat32Array(analyserNode.fftSize)
  const input = new Float32Array(detector.inputLength)
  updatePitch(analyserNode, detector, input, audioContext.sampleRate)
}

start()
