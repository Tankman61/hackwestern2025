"""
Helper functions for formatting numbers in speech-friendly format
"""


def format_crypto_amount(amount: float) -> str:
    """
    Format cryptocurrency amounts for TTS (e.g., 0.002 BTC, 1.5 ETH)

    Examples:
        0.002 -> "point zero zero two"
        0.5 -> "point five"
        1.25 -> "one point two five"
        10 -> "ten"
    """
    if amount >= 1:
        # For amounts >= 1, say whole and decimal parts
        whole = int(amount)
        decimal = amount - whole

        if decimal == 0:
            return str(whole)
        else:
            # Say decimal digits individually
            decimal_str = f"{decimal:.10f}".split('.')[1].rstrip('0')
            decimal_words = ' '.join(decimal_str)
            return f"{whole} point {decimal_words}"
    else:
        # For amounts < 1, say "point" + each digit
        decimal_str = f"{amount:.10f}".split('.')[1].rstrip('0')
        decimal_words = ' '.join(decimal_str)
        return f"point {decimal_words}"


def format_price_speech(price: float) -> str:
    """
    Format USD prices for TTS (e.g., $86,075.97)

    Examples:
        86075.97 -> "eighty-six thousand seventy-five dollars and ninety-seven cents"
        150.50 -> "one hundred fifty dollars and fifty cents"
        5 -> "five dollars"
    """
    if price >= 1000:
        thousands = int(price / 1000)
        remainder = price % 1000
        dollars = int(remainder)
        cents = int((remainder - dollars) * 100)
        if cents > 0:
            return f"{thousands} thousand {dollars} dollars and {cents} cents"
        elif dollars > 0:
            return f"{thousands} thousand {dollars} dollars"
        else:
            return f"{thousands} thousand dollars"
    else:
        dollars = int(price)
        cents = int((price - dollars) * 100)
        if cents > 0:
            return f"{dollars} dollars and {cents} cents"
        return f"{dollars} dollars"