from setuptools import setup, find_packages

setup(
    name='pyproj',
    version='1.0.0',
    author='Test Joe',
    author_email='your_email@example.com',
    description='Test project for erdev extension',
    packages=find_packages(),
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
    ],
    scripts=['bin/pyproj'],  # Add this line to include the pyproj executable
    
    install_requires=[
        'pandas',
    ],
)