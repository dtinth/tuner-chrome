const $ = (id) => document.getElementById(id)

async function main() {
  try {
    const please = $('please')
    const text = please.innerText
    please.textContent = ''
    please.hidden = false
    for (let i = 0; i < 60; i++) {
      please.textContent = text.substr(0, Math.ceil((i / 60) * text.length))
      await new Promise((resolve) => setTimeout(resolve, 16))
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { autoGainControl: false },
    })
    // Close all tracks
    stream.getTracks().forEach((track) => track.stop())
    $('please').hidden = true
    $('granted').hidden = false
  } catch (e) {
    $('please').hidden = true
    $('denied').hidden = false
  }
}
main()
