An AI model to detect and analyze receipts, combining computer vision with OCR to extract total amounts.

How it works:
The system has two stages. First, a fine-tuned MobileNetV2 classifier validates whether an uploaded image is actually a receipt (achieving 100% validation accuracy on my test set). This filtering step prevents wasted processing on random images.

Once validated, the image goes through EasyOCR for text extraction, then a custom parser identifies the total amount. The parser currently sits at around 70% accuracy - good enough for this demo, but there's definitely room for improvement.

Technical approach:
I used transfer learning to make this work with just 95 training images. The MobileNetV2 base (pretrained on ImageNet) stayed frozen while I trained only a small classification head on top. To prevent overfitting on such a small dataset, I applied L2 regularization and 30% dropout.
The confidence scores you see come from the sigmoid activation in the final layer - values close to 1.0 mean the model is very confident it's a receipt, close to 0.0 means it's confident it's not.


I tested it with both digital receipts and thermal printed ones - both worked well. Non-receipt images correctly get rejected. The model isn't perfect, though. It can be tricked by images with lots of text, but in those cases, the confidence score is usually pretty low, which is a useful signal.
This is just a demo to showcase the ML model. I'll share the source code once I finish building out the full application. Right now, I'm planning a better training pipeline with more data and improved architectures for when I scale this up.
Tech stack: TensorFlow.js, MobileNetV2, EasyOCR, Node.js
