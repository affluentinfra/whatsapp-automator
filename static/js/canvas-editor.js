// Canvas Studio Editor & Preview personalizer - Fabric.js wrapper

let designerCanvas = null;
let previewCanvas = null;
let activeTemplate = null;
let selectedFabricObject = null;
let bgOriginalWidth = 800;
let bgOriginalHeight = 800;

// Initialize Designer Canvas for Admins
function initDesignerCanvas(backgroundImageUrl) {
    if (designerCanvas) {
        designerCanvas.dispose();
    }

    // Set container sizing
    const container = document.querySelector(".canvas-stage");
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;

    // Create Fabric instance
    designerCanvas = new fabric.Canvas("canvas-designer", {
        width: 600,
        height: 600,
        backgroundColor: "#111"
    });

    // Load background image
    fabric.Image.fromURL(backgroundImageUrl, function (img) {
        bgOriginalWidth = img.width;
        bgOriginalHeight = img.height;

        // Calculate scale to fit container (maintain aspect ratio)
        let scale = 1;
        if (bgOriginalWidth > bgOriginalHeight) {
            scale = (containerWidth > 600 ? 600 : containerWidth) / bgOriginalWidth;
        } else {
            scale = (containerHeight > 600 ? 600 : containerHeight) / bgOriginalHeight;
        }

        const displayWidth = bgOriginalWidth * scale;
        const displayHeight = bgOriginalHeight * scale;

        designerCanvas.setDimensions({
            width: displayWidth,
            height: displayHeight
        });

        // Set background image stretched to display bounds
        img.set({
            scaleX: displayWidth / img.width,
            scaleY: displayHeight / img.height,
            selectable: false,
            evented: false
        });
        designerCanvas.setBackgroundImage(img, designerCanvas.renderAll.bind(designerCanvas));
        
        // Setup Event Listeners
        setupDesignerEvents();
        
        // Draw existing fields if loading template
        if (activeTemplate && activeTemplate.fields) {
            loadTemplateFieldsToDesigner(activeTemplate.fields);
        }
    }, { crossOrigin: 'anonymous' });
}

// Convert absolute values to percentages of background bounds
function getPercentCoords(obj) {
    const canvasW = designerCanvas.width;
    const canvasH = designerCanvas.height;
    
    // Scale properties of fabric object
    const scaleX = obj.scaleX || 1;
    const scaleY = obj.scaleY || 1;
    const w = obj.width * scaleX;
    const h = obj.height * scaleY;

    // Retrieve active gradient choice from UI input if selected
    const gradSelect = document.getElementById("prop-text-gradient");
    const activeGrad = (gradSelect && selectedFabricObject === obj) ? gradSelect.value : (obj.gradientFillName || "");

    return {
        name: obj.mappingName || "Custom Text",
        type: obj.fieldType || "text",
        position_x: (obj.left / canvasW) * 100,
        position_y: (obj.top / canvasH) * 100,
        width: (w / canvasW) * 100,
        height: (h / canvasH) * 100,
        is_default: obj.isDefault || 0,
        font_family: obj.fontFamily || "Inter",
        font_size: Math.round(obj.fontSize || 24),
        font_weight: obj.fontWeight || "normal",
        text_color: (typeof obj.fill === "string") ? obj.fill : "#ffffff",
        extra_styles: {
            fontStyle: obj.fontStyle || "normal",
            underline: obj.underline || false,
            textAlign: obj.textAlign || "left",
            opacity: obj.opacity || 1.0,
            angle: obj.angle || 0,
            
            // Custom Styling variables saved in extra_styles JSON block
            textBackgroundColor: obj.textBackgroundColor || "",
            stroke: obj.stroke || "",
            strokeWidth: obj.strokeWidth || 0,
            shadowBlur: obj.shadow ? obj.shadow.blur : 0,
            shadowColor: obj.shadow ? obj.shadow.color : "",
            gradientFillName: activeGrad
        }
    };
}

// Draw database template fields onto the active designer canvas
function loadTemplateFieldsToDesigner(fields) {
    fields.forEach(f => {
        const canvasW = designerCanvas.width;
        const canvasH = designerCanvas.height;
        
        const left = (f.position_x / 100) * canvasW;
        const top = (f.position_y / 100) * canvasH;
        const width = (f.width / 100) * canvasW;
        const height = (f.height / 100) * canvasH;
        
        // Load extra styles if serialized
        let extra = {};
        if (f.extra_styles) {
            extra = typeof f.extra_styles === "string" ? JSON.parse(f.extra_styles) : f.extra_styles;
        }

        if (f.type === "text") {
            const textObj = new fabric.Textbox(`[${f.name}]`, {
                left: left,
                top: top,
                width: width,
                fontSize: f.font_size,
                fontFamily: f.font_family,
                fontWeight: f.font_weight,
                fill: f.text_color,
                fontStyle: extra.fontStyle || "normal",
                underline: extra.underline || false,
                textAlign: extra.textAlign || "left",
                opacity: extra.opacity || 1.0,
                angle: extra.angle || 0,
                
                // Set outline and background colors
                textBackgroundColor: extra.textBackgroundColor || "",
                stroke: extra.stroke || null,
                strokeWidth: extra.strokeWidth || 0,
                cornerColor: "#6366f1",
                cornerSize: 8,
                transparentCorners: false,
                hasRotatingPoint: true
            });

            // Set drop shadow details
            if (extra.shadowBlur > 0) {
                textObj.set("shadow", new fabric.Shadow({
                    color: extra.shadowColor || "#000000",
                    blur: extra.shadowBlur,
                    offsetX: 2,
                    offsetY: 2
                }));
            }

            // Set gradient colors
            if (extra.gradientFillName) {
                textObj.gradientFillName = extra.gradientFillName;
                applyGradientToObjectDirectly(textObj, extra.gradientFillName, false);
            }

            // Preload Google Font
            if (f.font_family) {
                loadFontAndRender(f.font_family);
            }

            textObj.fieldType = "text";
            textObj.mappingName = f.name;
            textObj.isDefault = f.is_default;
            designerCanvas.add(textObj);
        } else {
            // Draw placeholder image block
            const rectObj = new fabric.Rect({
                left: left,
                top: top,
                width: width,
                height: height,
                fill: "rgba(99, 102, 241, 0.15)",
                stroke: "#6366f1",
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                opacity: extra.opacity || 1.0,
                angle: extra.angle || 0,
                cornerColor: "#6366f1",
                cornerSize: 8,
                transparentCorners: false
            });
            rectObj.fieldType = "image";
            rectObj.mappingName = f.name;
            rectObj.isDefault = f.is_default;
            designerCanvas.add(rectObj);
        }
    });
    designerCanvas.renderAll();
    renderDesignerFieldsSidebar();
}

function setupDesignerEvents() {
    designerCanvas.on("selection:created", (e) => handleObjectSelection(e.selected[0]));
    designerCanvas.on("selection:updated", (e) => handleObjectSelection(e.selected[0]));
    designerCanvas.on("selection:cleared", () => clearInspector());
    
    designerCanvas.on("object:moving", (e) => {
        const obj = e.target;
        const scaleX = obj.scaleX || 1;
        const scaleY = obj.scaleY || 1;
        const w = obj.width * scaleX;
        const h = obj.height * scaleY;
        
        // Boundaries clamping: Prevent elements from dragging outside canvas background image
        if (obj.left < 0) obj.left = 0;
        if (obj.top < 0) obj.top = 0;
        if (obj.left + w > designerCanvas.width) obj.left = designerCanvas.width - w;
        if (obj.top + h > designerCanvas.height) obj.top = designerCanvas.height - h;
        
        syncInspectorCoords();
    });

    designerCanvas.on("object:scaling", (e) => {
        const obj = e.target;
        const scaleX = obj.scaleX || 1;
        const scaleY = obj.scaleY || 1;
        const w = obj.width * scaleX;
        const h = obj.height * scaleY;

        // Boundaries clamping: Prevent scaling beyond template boundaries
        if (obj.left + w > designerCanvas.width) {
            obj.scaleX = (designerCanvas.width - obj.left) / obj.width;
        }
        if (obj.top + h > designerCanvas.height) {
            obj.scaleY = (designerCanvas.height - obj.top) / obj.height;
        }
        syncInspectorCoords();
    });
    
    designerCanvas.on("object:rotating", () => syncInspectorCoords());
}

function handleObjectSelection(obj) {
    selectedFabricObject = obj;
    document.getElementById("inspector-empty").classList.add("hidden");
    const controls = document.getElementById("inspector-controls-box");
    controls.classList.remove("hidden");

    // General Fields
    document.getElementById("prop-mapping-field").value = obj.mappingName || "Custom Text";
    document.getElementById("prop-width").value = Math.round(obj.width * (obj.scaleX || 1));
    document.getElementById("prop-height").value = Math.round(obj.height * (obj.scaleY || 1));
    document.getElementById("prop-rotation").value = Math.round(obj.angle || 0);
    document.getElementById("prop-opacity").value = obj.opacity || 1.0;

    if (obj.fieldType === "text") {
        document.getElementById("inspector-text-section").classList.remove("hidden");
        document.getElementById("inspector-image-section").classList.add("hidden");

        document.getElementById("prop-font-family").value = obj.fontFamily || "Inter";
        document.getElementById("prop-font-size").value = obj.fontSize || 24;
        document.getElementById("prop-align").value = obj.textAlign || "left";
        document.getElementById("prop-text-color").value = (typeof obj.fill === "string") ? obj.fill : "#ffffff";
        
        // Populating advanced styling elements
        document.getElementById("prop-text-bg-color").value = obj.textBackgroundColor || "#ffffff";
        document.getElementById("prop-stroke-color").value = obj.stroke || "#000000";
        document.getElementById("prop-stroke-width").value = obj.strokeWidth || 0;
        document.getElementById("prop-shadow-blur").value = obj.shadow ? obj.shadow.blur : 0;
        document.getElementById("prop-shadow-color").value = obj.shadow ? obj.shadow.color : "#000000";
        document.getElementById("prop-text-gradient").value = (obj.fill && obj.fill.colorStops) ? "" : ""; // Default to solid option unless set

        // Set style buttons active states
        document.getElementById("btn-bold").classList.toggle("active", obj.fontWeight === "bold");
        document.getElementById("btn-italic").classList.toggle("active", obj.fontStyle === "italic");
        document.getElementById("btn-underline").classList.toggle("active", obj.underline === true);
    } else {
        document.getElementById("inspector-text-section").classList.add("hidden");
        document.getElementById("inspector-image-section").classList.remove("hidden");
        document.getElementById("prop-img-badge").innerText = `Dynamic ${obj.mappingName}`;
    }
}

function clearInspector() {
    selectedFabricObject = null;
    document.getElementById("inspector-empty").classList.remove("hidden");
    document.getElementById("inspector-controls-box").classList.add("hidden");
}

function syncInspectorCoords() {
    if (!selectedFabricObject) return;
    document.getElementById("prop-width").value = Math.round(selectedFabricObject.width * (selectedFabricObject.scaleX || 1));
    document.getElementById("prop-height").value = Math.round(selectedFabricObject.height * (selectedFabricObject.scaleY || 1));
    document.getElementById("prop-rotation").value = Math.round(selectedFabricObject.angle || 0);
}

// Modify properties from Inspector Controls
function updateSelectedProp(property, value) {
    if (!selectedFabricObject) return;

    if (property === "name") {
        selectedFabricObject.mappingName = value;
        // If it's a default textbox, show mapped tag
        if (selectedFabricObject.fieldType === "text") {
            selectedFabricObject.set("text", `[${value}]`);
        }
        renderDesignerFieldsSidebar();
    } else {
        selectedFabricObject.set(property, value);
        if (property === "fontFamily") {
            loadFontAndRender(value);
        }
    }
    
    designerCanvas.renderAll();
}

function updateSelectedSize(dimension, value) {
    if (!selectedFabricObject) return;
    if (dimension === "width") {
        selectedFabricObject.set("scaleX", 1);
        selectedFabricObject.set("width", value);
    } else {
        selectedFabricObject.set("scaleY", 1);
        selectedFabricObject.set("height", value);
    }
    designerCanvas.renderAll();
}

function toggleTextFormat(format) {
    if (!selectedFabricObject || selectedFabricObject.fieldType !== "text") return;

    if (format === "bold") {
        const isBold = selectedFabricObject.fontWeight === "bold";
        selectedFabricObject.set("fontWeight", isBold ? "normal" : "bold");
        document.getElementById("btn-bold").classList.toggle("active", !isBold);
    } else if (format === "italic") {
        const isItalic = selectedFabricObject.fontStyle === "italic";
        selectedFabricObject.set("fontStyle", isItalic ? "normal" : "italic");
        document.getElementById("btn-italic").classList.toggle("active", !isItalic);
    } else if (format === "underline") {
        const isUnderline = selectedFabricObject.underline === true;
        selectedFabricObject.set("underline", !isUnderline);
        document.getElementById("btn-underline").classList.toggle("active", !isUnderline);
    }
    designerCanvas.renderAll();
}

function addTextPlaceholder() {
    const textObj = new fabric.Textbox("[Custom Text]", {
        left: 100,
        top: 150,
        width: 250,
        fontSize: 24,
        fontFamily: "Inter",
        fill: "#ffffff",
        cornerColor: "#6366f1",
        cornerSize: 8,
        transparentCorners: false
    });
    textObj.fieldType = "text";
    textObj.mappingName = "Custom Text";
    textObj.isDefault = 0;
    
    designerCanvas.add(textObj);
    designerCanvas.setActiveObject(textObj);
    renderDesignerFieldsSidebar();
}

function addImagePlaceholder() {
    const rectObj = new fabric.Rect({
        left: 100,
        top: 250,
        width: 120,
        height: 120,
        fill: "rgba(99, 102, 241, 0.15)",
        stroke: "#6366f1",
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        cornerColor: "#6366f1",
        cornerSize: 8,
        transparentCorners: false
    });
    rectObj.fieldType = "image";
    rectObj.mappingName = "Logo";
    rectObj.isDefault = 0;

    designerCanvas.add(rectObj);
    designerCanvas.setActiveObject(rectObj);
    renderDesignerFieldsSidebar();
}

function deleteSelectedField() {
    if (!selectedFabricObject) return;
    if (selectedFabricObject.isDefault === 1) {
        showToast("Cannot delete default field (Name & Mobile).", "error");
        return;
    }
    designerCanvas.remove(selectedFabricObject);
    clearInspector();
    renderDesignerFieldsSidebar();
}

function renderDesignerFieldsSidebar() {
    const listContainer = document.getElementById("editor-fields-list");
    listContainer.innerHTML = "";
    
    if (!designerCanvas) return;
    
    const objects = designerCanvas.getObjects();
    objects.forEach(obj => {
        if (obj === designerCanvas.backgroundImage) return;
        
        const item = document.createElement("div");
        item.className = "editor-field-item";
        
        const typeIcon = obj.fieldType === "text" ? '<i class="fa-solid fa-font"></i>' : '<i class="fa-solid fa-image"></i>';
        
        item.innerHTML = `
            <span>${typeIcon} ${obj.mappingName || "Unnamed"}</span>
            <small>${obj.fieldType}</small>
        `;
        
        item.onclick = () => {
            designerCanvas.setActiveObject(obj);
            designerCanvas.renderAll();
            handleObjectSelection(obj);
        };
        
        listContainer.appendChild(item);
    });
}


// --- 2. PERSONALIZER & SHARING CANVAS FUNCTIONS ---

// Compile fields mapping overrides and render inside preview canvas
function initPreviewCanvas(template, contactData, overrideVals = {}) {
    if (previewCanvas) {
        previewCanvas.dispose();
    }

    const canvasEl = document.getElementById("canvas-preview");
    previewCanvas = new fabric.Canvas("canvas-preview", {
        width: 600,
        height: 600,
        backgroundColor: "#111",
        selection: false // Disable direct drag-drop for user sharing view
    });

    fabric.Image.fromURL(template.background_url, function (img) {
        bgOriginalWidth = img.width;
        bgOriginalHeight = img.height;

        // Scale fit within preview card bounds
        const container = document.querySelector(".canvas-stage");
        const scale = Math.min(500 / bgOriginalWidth, 500 / bgOriginalHeight);
        
        previewCanvas.setDimensions({
            width: bgOriginalWidth * scale,
            height: bgOriginalHeight * scale
        });

        img.set({
            scaleX: (bgOriginalWidth * scale) / img.width,
            scaleY: (bgOriginalHeight * scale) / img.height,
            selectable: false,
            evented: false
        });
        previewCanvas.setBackgroundImage(img, previewCanvas.renderAll.bind(previewCanvas));

        // Draw custom fields with mapped data
        template.fields.forEach(f => {
            const canvasW = previewCanvas.width;
            const canvasH = previewCanvas.height;
            
            const left = (f.position_x / 100) * canvasW;
            const top = (f.position_y / 100) * canvasH;
            const width = (f.width / 100) * canvasW;
            const height = (f.height / 100) * canvasH;

            let extra = {};
            if (f.extra_styles) {
                extra = typeof f.extra_styles === "string" ? JSON.parse(f.extra_styles) : f.extra_styles;
            }

            // Determine final values based on Overrides -> Contact values -> Defaults
            const fieldKey = f.name;
            let displayVal = "";
            
            if (f.type === "text") {
                if (overrideVals[fieldKey] !== undefined) {
                    displayVal = overrideVals[fieldKey];
                } else if (contactData) {
                    // Match mapping names
                    if (fieldKey === "Name") displayVal = contactData.name;
                    else if (fieldKey === "Mobile") displayVal = contactData.mobile;
                    else if (fieldKey === "Company") displayVal = contactData.company;
                    else if (fieldKey === "Designation") displayVal = contactData.designation;
                    else if (fieldKey === "Website") displayVal = contactData.website || "www.yourwebsite.com";
                    else if (fieldKey === "Email") displayVal = contactData.email || "email@company.com";
                    else displayVal = contactData[fieldKey.toLowerCase()] || `[${f.name}]`;
                } else {
                    displayVal = `[Enter ${f.name}]`;
                }

                const textObj = new fabric.Textbox(displayVal, {
                    left: left,
                    top: top,
                    width: width,
                    fontSize: f.font_size,
                    fontFamily: f.font_family,
                    fontWeight: f.font_weight,
                    fill: f.text_color,
                    fontStyle: extra.fontStyle || "normal",
                    underline: extra.underline || false,
                    textAlign: extra.textAlign || "left",
                    opacity: extra.opacity || 1.0,
                    angle: extra.angle || 0,
                    selectable: false,
                    evented: false
                });
                previewCanvas.add(textObj);
            } else {
                // If it is an image block, we can render a standard visual fallback block
                // (In a real system, load uploaded logo/profile photo dynamic URLs)
                const textPlaceholder = new fabric.Textbox(`[${f.name} Box]`, {
                    left: left,
                    top: top,
                    width: width,
                    fontSize: 16,
                    fontFamily: "Inter",
                    fill: "#fff",
                    textAlign: "center",
                    selectable: false,
                    evented: false
                });

                const rectObj = new fabric.Rect({
                    left: left,
                    top: top,
                    width: width,
                    height: height,
                    fill: "rgba(99, 102, 241, 0.2)",
                    stroke: "#6366f1",
                    strokeWidth: 1,
                    opacity: extra.opacity || 1.0,
                    angle: extra.angle || 0,
                    selectable: false,
                    evented: false
                });
                previewCanvas.add(rectObj);
                previewCanvas.add(textPlaceholder);
            }
        });
        previewCanvas.renderAll();
    }, { crossOrigin: 'anonymous' });
}

// Generate the high-resolution image output (Render dynamically on native dimensions)
function renderHighResBase64(template, contactData, overrideVals = {}) {
    return new Promise((resolve) => {
        // Create an offscreen temporary fabric canvas
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = bgOriginalWidth;
        tempCanvas.height = bgOriginalHeight;
        
        const offscreenCanvas = new fabric.StaticCanvas(tempCanvas);

        fabric.Image.fromURL(template.background_url, function (img) {
            img.set({
                scaleX: bgOriginalWidth / img.width,
                scaleY: bgOriginalHeight / img.height
            });
            offscreenCanvas.setBackgroundImage(img, offscreenCanvas.renderAll.bind(offscreenCanvas));

            // Map and overlay items
            template.fields.forEach(f => {
                const left = (f.position_x / 100) * bgOriginalWidth;
                const top = (f.position_y / 100) * bgOriginalHeight;
                const width = (f.width / 100) * bgOriginalWidth;
                const height = (f.height / 100) * bgOriginalHeight;

                let extra = {};
                if (f.extra_styles) {
                    extra = typeof f.extra_styles === "string" ? JSON.parse(f.extra_styles) : f.extra_styles;
                }

                const fieldKey = f.name;
                let displayVal = "";
                
                if (f.type === "text") {
                    if (overrideVals[fieldKey] !== undefined) {
                        displayVal = overrideVals[fieldKey];
                    } else if (contactData) {
                        if (fieldKey === "Name") displayVal = contactData.name;
                        else if (fieldKey === "Mobile") displayVal = contactData.mobile;
                        else if (fieldKey === "Company") displayVal = contactData.company;
                        else if (fieldKey === "Designation") displayVal = contactData.designation;
                        else if (fieldKey === "Website") displayVal = contactData.website || "www.yourwebsite.com";
                        else if (fieldKey === "Email") displayVal = contactData.email || "email@company.com";
                        else displayVal = contactData[fieldKey.toLowerCase()] || `[${f.name}]`;
                    } else {
                        displayVal = `[${f.name}]`;
                    }

                    // Scale font size to match native background scale compared to designer bounds
                    // Designer display dimensions are scaled.
                    // We must output native high-res. The original field font size was relative to designer height (600px).
                    // We calculate native font scale:
                    const fontScale = bgOriginalHeight / 500; // 500 was original base scaling height
                    const targetFontSize = Math.max(10, Math.round(f.font_size * fontScale));

                    const textObj = new fabric.Textbox(displayVal, {
                        left: left,
                        top: top,
                        width: width,
                        fontSize: targetFontSize,
                        fontFamily: f.font_family,
                        fontWeight: f.font_weight,
                        fill: f.text_color,
                        fontStyle: extra.fontStyle || "normal",
                        underline: extra.underline || false,
                        textAlign: extra.textAlign || "left",
                        opacity: extra.opacity || 1.0,
                        angle: extra.angle || 0,
                        
                        // Apply custom outline and highlights
                        textBackgroundColor: extra.textBackgroundColor || "",
                        stroke: extra.stroke || null,
                        strokeWidth: extra.strokeWidth || 0
                    });

                    // Set drop shadow details
                    if (extra.shadowBlur > 0) {
                        textObj.set("shadow", new fabric.Shadow({
                            color: extra.shadowColor || "#000000",
                            blur: extra.shadowBlur,
                            offsetX: 2,
                            offsetY: 2
                        }));
                    }

                    // Set gradient colors
                    if (extra.gradientFillName) {
                        applyGradientToObjectDirectly(textObj, extra.gradientFillName, true);
                    }

                    // Preload Google Font
                    if (f.font_family) {
                        loadFontAndRender(f.font_family);
                    }

                    offscreenCanvas.add(textObj);
                } else {
                    // Image Box overlay mock
                    const rectObj = new fabric.Rect({
                        left: left,
                        top: top,
                        width: width,
                        height: height,
                        fill: "rgba(99, 102, 241, 0.2)",
                        stroke: "#6366f1",
                        strokeWidth: 2,
                        opacity: extra.opacity || 1.0,
                        angle: extra.angle || 0
                    });
                    offscreenCanvas.add(rectObj);
                    
                    const textPlaceholder = new fabric.Textbox(`[${f.name}]`, {
                        left: left,
                        top: top + (height/2) - 10,
                        width: width,
                        fontSize: Math.round(16 * (bgOriginalHeight / 500)),
                        fontFamily: "Inter",
                        fill: "#ffffff",
                        textAlign: "center"
                    });
                    offscreenCanvas.add(textPlaceholder);
                }
            });

            offscreenCanvas.renderAll();
            
            // Retrieve dataURL as PNG
            const base64Data = offscreenCanvas.toDataURL({
                format: "png",
                quality: 1.0
            });
            
            offscreenCanvas.dispose();
            resolve(base64Data);
        }, { crossOrigin: 'anonymous' });
    });
}

// Advanced Styling Helpers
function applyTextGradientFromUI(gradientName) {
    if (!selectedFabricObject) return;
    if (!gradientName) {
        const solidColor = document.getElementById("prop-text-color").value || "#ffffff";
        selectedFabricObject.set("fill", solidColor);
        selectedFabricObject.gradientFillName = "";
        designerCanvas.renderAll();
        return;
    }
    selectedFabricObject.gradientFillName = gradientName;
    applyGradientToObjectDirectly(selectedFabricObject, gradientName, false);
    designerCanvas.renderAll();
}

function updateTextShadowFromUI() {
    if (!selectedFabricObject) return;
    const blur = parseInt(document.getElementById("prop-shadow-blur").value) || 0;
    const color = document.getElementById("prop-shadow-color").value || "#000000";
    
    if (blur === 0) {
        selectedFabricObject.set("shadow", null);
    } else {
        selectedFabricObject.set("shadow", new fabric.Shadow({
            color: color,
            blur: blur,
            offsetX: 2,
            offsetY: 2
        }));
    }
    designerCanvas.renderAll();
}

function applyGradientToObjectDirectly(obj, gradientName, useNativeWidth = false) {
    const gradColors = {
        purple_pink: [
            { offset: 0, color: '#8A2387' },
            { offset: 0.5, color: '#E94057' },
            { offset: 1, color: '#F27121' }
        ],
        sunset: [
            { offset: 0, color: '#f12711' },
            { offset: 1, color: '#f5af19' }
        ],
        ocean: [
            { offset: 0, color: '#00c6ff' },
            { offset: 1, color: '#0072ff' }
        ],
        neon: [
            { offset: 0, color: '#00F260' },
            { offset: 1, color: '#0575E6' }
        ]
    }[gradientName];

    if (!gradColors) return;

    // Calculate bounding width
    const w = useNativeWidth ? obj.width : obj.width * (obj.scaleX || 1);

    const grad = new fabric.Gradient({
        type: 'linear',
        coords: {
            x1: 0,
            y1: 0,
            x2: w,
            y2: 0
        },
        colorStops: gradColors
    });

    obj.set("fill", grad);
}

function arrangeLayer(action) {
    if (!selectedFabricObject) return;
    
    if (action === "front") {
        selectedFabricObject.bringToFront();
    } else if (action === "back") {
        selectedFabricObject.sendToBack();
        // Keep the background image at the absolute bottom
        const bg = designerCanvas.backgroundImage;
        if (bg) {
            bg.sendToBack();
        }
    } else if (action === "forward") {
        selectedFabricObject.bringForward();
    } else if (action === "backward") {
        selectedFabricObject.sendBackwards();
        // Make sure we don't go behind background image
        const bg = designerCanvas.backgroundImage;
        if (bg && designerCanvas.getObjects().indexOf(selectedFabricObject) === 0) {
            selectedFabricObject.bringForward();
        }
    }
    
    designerCanvas.renderAll();
    renderDesignerFieldsSidebar();
}

function loadFontAndRender(fontName) {
    if (!fontName) return;
    
    document.fonts.load(`1em "${fontName}"`).then(() => {
        if (designerCanvas) {
            designerCanvas.requestRenderAll();
        }
        if (previewCanvas) {
            previewCanvas.requestRenderAll();
        }
    });
}
