print("START")
import traceback
print("START 2")
try:
    from main import get_signal_internal
    print("START 3")
    res = get_signal_internal('AAPL')
    print('SUCCESS')
    print(res.keys() if isinstance(res, dict) else type(res))
except Exception as e:
    print('FAILED')
    traceback.print_exc()
