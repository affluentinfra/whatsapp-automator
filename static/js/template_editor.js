// template_editor.js – client side editor for WhatsApp template
document.addEventListener('DOMContentLoaded', function () {
  const canvasEl = document.getElementById('template-canvas');
  const backgroundUrl = canvasEl.getAttribute('data-background-url');
  const canvas = new fabric.Canvas('template-canvas', {
    preserveObjectStacking: true
  });

  // Load background image (template base)
  if (backgroundUrl) {
    fabric.Image.fromURL(backgroundUrl, function (img) {
      img.set({ selectable: false, evented: false });
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        scaleX: canvas.width / img.width,
        scaleY: canvas.height / img.height
      });
    }, { crossOrigin: 'anonymous' });
  }

  // Add Text
  document.getElementById('add-text').addEventListener('click', function () {
    const text = new fabric.IText('Sample Text', {
      left: 100,
      top: 100,
      fontFamily: 'Inter',
      fontSize: 24,
      fill: '#000000'
    });
    canvas.add(text).setActiveObject(text);
  });

  // Add Image
  const imageInput = document.getElementById('image-input');
  document.getElementById('add-image').addEventListener('click', function () {
    imageInput.click();
  });
  imageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (f) {
      fabric.Image.fromURL(f.target.result, function (img) {
        img.set({ left: 150, top: 150, scaleX: 0.5, scaleY: 0.5 });
        canvas.add(img).setActiveObject(img);
      });
    };
    reader.readAsDataURL(file);
  });

  // Save – serialize canvas to PNG and POST to /api/template-fields (placeholder)
  document.getElementById('save-template').addEventListener('click', async function () {
    // Export canvas as PNG dataURL
    const dataUrl = canvas.toDataURL({ format: 'png' });
    // Send to backend – here we just call a placeholder endpoint
    try {
      const response = await fetch('/api/templates/' + TEMPLATE_ID + '/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: dataUrl })
      });
      if (!response.ok) throw new Error('Save failed');
      alert('Template saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving template');
    }
  });
});
