import easyocr
import sys
import json

def read_image(image_path, languages=['en', 'ar']):
    # initialize reader — downloads weights first time, cached after
    reader = easyocr.Reader(languages, gpu=False)
    
    # readtext returns list of [bbox, text, confidence]
    results = reader.readtext(image_path)
    
    output = []
    for (bbox, text, conf) in results:
        # bbox is [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        # convert to [x, y, w, h] format to match our existing structure
        x = int(bbox[0][0])
        y = int(bbox[0][1])
        w = int(bbox[2][0] - bbox[0][0])
        h = int(bbox[2][1] - bbox[0][1])
        
        output.append({
            'text': text,
            'confidence': round(conf, 4),
            'x': x,
            'y': y,
            'w': w,
            'h': h
        })
    
    # print as JSON so Node.js can parse it
    print(json.dumps(output))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'no image path provided'}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    read_image(image_path)