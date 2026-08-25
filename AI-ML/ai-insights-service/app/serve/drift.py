from math import log


def psi(baseline, current, buckets=10):
    if not baseline or not current:
        return 0.0

    low, high = min(baseline), max(baseline)
    if high == low:
        high = low + 1
    edges = [low + (high - low) * index / buckets for index in range(buckets + 1)]

    def distribution(values):
        counts = [0] * buckets
        for value in values:
            index = next((item for item in range(buckets) if value <= edges[item + 1]), buckets - 1)
            counts[min(buckets - 1, max(0, index))] += 1
        return [max(count / len(values), 1e-4) for count in counts]

    baseline_distribution = distribution(baseline)
    current_distribution = distribution(current)
    return sum(
        (current_value - baseline_value) * log(current_value / baseline_value)
        for baseline_value, current_value in zip(baseline_distribution, current_distribution)
    )
