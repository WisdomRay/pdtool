import nltk
from nltk.tokenize import PunktSentenceTokenizer

nltk.download('punkt')  # Just to be safe

text = "Hello there! This is a simple sentence tokenizer test. Let's see if it works."

tokenizer = PunktSentenceTokenizer()
sentences = tokenizer.tokenize(text)

for idx, sentence in enumerate(sentences, 1):
    print(f"Sentence {idx}: {sentence}")
